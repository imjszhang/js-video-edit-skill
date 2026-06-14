export interface CliContext {
  verbose: boolean;
  dryRun: boolean;
}

export const cliContext: CliContext = {
  verbose: false,
  dryRun: false,
};

export function setCliContext(opts: Partial<CliContext>): void {
  if (opts.verbose !== undefined) cliContext.verbose = opts.verbose;
  if (opts.dryRun !== undefined) cliContext.dryRun = opts.dryRun;
}
