use std::path::PathBuf;

#[derive(structopt::StructOpt, Debug)]
#[structopt(name = "COMIT btsieve daemon")]
pub struct Options {
    /// Path to configuration file
    #[structopt(short = "c", long = "config", parse(from_os_str))]
    pub config_file: Option<PathBuf>,
}
