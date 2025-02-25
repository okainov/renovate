import * as defaultsParser from '../../../../config/defaults';
import { AllConfig } from '../../../../config/types';
import { mergeChildConfig } from '../../../../config/utils';
import { addStream, logger, setContext } from '../../../../logger';
import { ensureDir, getSubDirectory, readFile } from '../../../../util/fs';
import { ensureTrailingSlash } from '../../../../util/url';
import * as cliParser from './cli';
import * as envParser from './env';
import * as fileParser from './file';

export async function parseConfigs(
  env: NodeJS.ProcessEnv,
  argv: string[]
): Promise<AllConfig> {
  logger.debug('Parsing configs');

  // Get configs
  const defaultConfig = defaultsParser.getConfig();
  const fileConfig = fileParser.getConfig(env);
  const cliConfig = cliParser.getConfig(argv);
  const envConfig = envParser.getConfig(env);

  let config: AllConfig = mergeChildConfig(fileConfig, envConfig);
  config = mergeChildConfig(config, cliConfig);

  const combinedConfig = config;

  config = mergeChildConfig(defaultConfig, config);

  if (config.forceCli) {
    const forcedCli = { ...cliConfig };
    delete forcedCli.token;
    delete forcedCli.hostRules;
    if (config.force) {
      config.force = { ...config.force, ...forcedCli };
    } else {
      config.force = forcedCli;
    }
  }

  if (!config.privateKey && config.privateKeyPath) {
    config.privateKey = await readFile(config.privateKeyPath, 'utf8');
    delete config.privateKeyPath;
  }

  if (!config.privateKeyOld && config.privateKeyPathOld) {
    config.privateKey = await readFile(config.privateKeyPathOld, 'utf8');
    delete config.privateKeyPathOld;
  }

  if (config.logContext) {
    // This only has an effect if logContext was defined via file or CLI, otherwise it would already have been detected in env
    setContext(config.logContext);
  }

  // Add file logger
  // istanbul ignore if
  if (config.logFile) {
    logger.debug(
      `Enabling ${config.logFileLevel} logging to ${config.logFile}`
    );
    await ensureDir(getSubDirectory(config.logFile));
    addStream({
      name: 'logfile',
      path: config.logFile,
      level: config.logFileLevel,
    });
  }

  logger.trace({ config: defaultConfig }, 'Default config');
  logger.debug({ config: fileConfig }, 'File config');
  logger.debug({ config: cliConfig }, 'CLI config');
  logger.debug({ config: envConfig }, 'Env config');
  logger.debug({ config: combinedConfig }, 'Combined config');

  // Get global config
  logger.trace({ config }, 'Full config');

  // Print config
  logger.trace({ config }, 'Global config');

  // Massage endpoint to have a trailing slash
  if (config.endpoint) {
    logger.debug('Adding trailing slash to endpoint');
    config.endpoint = ensureTrailingSlash(config.endpoint);
  }

  // Remove log file entries
  delete config.logFile;
  delete config.logFileLevel;

  return config;
}
