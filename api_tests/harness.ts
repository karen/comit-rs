///<reference path="./lib/satoshi_bitcoin.d.ts"/>

import { parse } from "@iarna/toml";
import { execSync } from "child_process";
import commander from "commander";
import * as fs from "fs";
import glob from "glob";
import { Configuration, configure, getLogger } from "log4js";
import Mocha from "mocha";
import path from "path";
import rimraf from "rimraf";
import { BtsieveRunner } from "./lib/btsieve_runner";
import { CndRunner } from "./lib/cnd_runner";
import { createBtsieveConfig } from "./lib/config";
import { LedgerRunner } from "./lib/ledger_runner";
import { HarnessGlobal } from "./lib/util";

commander
    .option("--dump-logs", "Dump logs to stdout on failure")
    .parse(process.argv);

// ************************ //
// Setting global variables //
// ************************ //

declare const global: HarnessGlobal;

const projectRoot: string = execSync("git rev-parse --show-toplevel", {
    encoding: "utf8",
}).trim();
global.projectRoot = projectRoot;

const testRoot = projectRoot + "/api_tests";
global.testRoot = testRoot;

const logDir = projectRoot + "/api_tests/log";

rimraf.sync(logDir);
fs.mkdirSync(logDir);

// ********************** //
// Start services helpers //
// ********************** //

export interface E2ETestConfig {
    actors: string[];
    ledgers: string[];
}

async function runTests(testFiles: string[]) {
    const testFileAppenders = testFiles.reduce(
        (appenders, fileName) => {
            appenders[fileName] = {
                type: "file",
                filename: `${logDir}/${fileName}/test-suite.log`,
            };

            return appenders;
        },
        {} as Configuration["appenders"]
    );

    configure({
        appenders: {
            ...testFileAppenders,
            harness: {
                type: "file",
                filename: `${logDir}/harness.log`,
            },
        },
        categories: {
            default: {
                appenders: [...testFiles, "harness"],
                level: "DEBUG",
            },
        },
    });

    const logger = getLogger("harness");

    const ledgerRunner = new LedgerRunner(logDir);

    const nodeRunner = new CndRunner(
        projectRoot,
        projectRoot + "/target/debug/cnd",
        logDir
    );
    const btsieveRunner = new BtsieveRunner(
        projectRoot,
        projectRoot + "/target/debug/btsieve",
        logDir
    );

    async function cleanupAll() {
        try {
            btsieveRunner.stopBtsieve();
            nodeRunner.stopCnds();
            await ledgerRunner.stopLedgers();
        } catch (_) {
            // we don't care much if the cleanup fails
        }
    }

    process.on("SIGINT", async () => {
        console.log("SIGINT RECEIEVED");

        await cleanupAll();

        process.exit(0);
    });

    process.on("unhandledRejection", async reason => {
        console.error(reason);

        await cleanupAll();

        process.exit(1);
    });

    for (const testFile of testFiles) {
        logger.info("Running test file ", testFile);

        const testDir = path.dirname(testFile);
        const config = (parse(
            fs.readFileSync(testDir + "/config.toml", "utf8")
        ) as unknown) as E2ETestConfig;

        if (config.ledgers) {
            logger.info("Booting ledgers", config.ledgers);

            await ledgerRunner.ensureLedgersRunning(config.ledgers);

            const ledgerConfigs = await ledgerRunner.getLedgerConfig();

            // We don't stop the ledgers between the test files
            // Make sure the btsieve we start is only configured to the ledgers that it needs as per the config file of the test
            const btsieveConfig = createBtsieveConfig({
                bitcoin: config.ledgers.includes("bitcoin")
                    ? ledgerConfigs.bitcoin
                    : undefined,
                ethereum: config.ledgers.includes("ethereum")
                    ? ledgerConfigs.ethereum
                    : undefined,
            });

            logger.info("Booting btsieve with config", btsieveConfig);

            await btsieveRunner.ensureBtsieveRunningWithConfig(btsieveConfig);
        }

        if (config.actors) {
            logger.info("Booting cnds for", config.actors);

            await nodeRunner.ensureCndsRunning(config.actors);
        }

        global.ledgerConfigs = await ledgerRunner.getLedgerConfig();

        logger.info("Executing tests");

        const runTests = new Promise(res => {
            new Mocha({ bail: true, ui: "bdd", delay: true })
                .addFile(testFile)
                .run((failures: number) => res(failures));
        });

        const failures = await runTests;

        if (failures) {
            if (commander.dumpLogs || process.env.CARGO_MAKE_CI === "TRUE") {
                execSync(`/bin/sh -c 'tail -n +1 ${testRoot}/log/*.log'`, {
                    stdio: "inherit",
                });
            }

            await cleanupAll();
            process.exit(1);
        }

        nodeRunner.stopCnds();
        btsieveRunner.stopBtsieve();
    }

    await cleanupAll();
    process.exit(0);
}

function validTestFile(path: string): boolean {
    return (
        validTestPath(path) &&
        /^.*.ts$/.test(path) &&
        !/^.*harness.ts$/.test(path)
    );
}

function validTestPath(path: string): boolean {
    return (
        !/^.*lib\/.*$/.test(path) &&
        !/^.*node_modules\/.*$/.test(path) &&
        !/^.*gen\/.*$/.test(path) &&
        !/^.*log\/.*$/.test(path) &&
        !/^.*regtest\/.*$/.test(path)
    );
}

function expandGlob(paths: string[]): string[] {
    if (!paths.length) {
        return expandGlob(["**/*.ts"]);
    }

    let result: string[] = [];
    for (const path of paths) {
        if (glob.hasMagic(path)) {
            const expandedPaths: string[] = glob.sync(path);
            for (const expandedPath of expandedPaths) {
                if (validTestFile(expandedPath)) {
                    result.push(expandedPath);
                }
            }
        } else if (fs.lstatSync(path).isDirectory()) {
            result = result.concat(expandGlob([path + "/**/*.ts"]));
        } else if (validTestFile(path)) {
            result.push(path);
        }
    }

    return result;
}

const args = commander.args;
const testFiles = expandGlob(args);
runTests(testFiles);
