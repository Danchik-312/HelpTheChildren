process.env.BABEL_ENV = 'test';
process.env.NODE_ENV = 'test';
process.env.PUBLIC_URL = '';

const path = require('path');
const createJestConfig = require('react-scripts/scripts/utils/createJestConfig');

const root = path.resolve(__dirname, '..');
const config = createJestConfig(
  relativePath => path.resolve(root, 'node_modules/react-scripts', relativePath),
  root,
  false,
);

config.cacheDirectory = path.resolve(root, 'node_modules', '.cache', 'jest');
delete config.testMatch;
config.testRegex = ['.*[.]test[.]jsx?$'];

const args = process.argv.slice(2);
const watchDisabled = process.env.CI === 'true' || args.includes('--watchAll=false');
const runInBand = args.includes('--runInBand');
const testPaths = args.filter(arg => !arg.startsWith('-'));

require('jest').runCLI({
  config: JSON.stringify(config),
  ...(testPaths.length && { testPathPattern: testPaths }),
  runInBand,
  watchAll: !watchDisabled,
}, [root]).then(result => {
  process.exit(result.results.success ? 0 : 1);
});
