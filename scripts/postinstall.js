/* eslint-disable max-len */
const emoji = require('node-emoji');

const env = process.env;
const ADBLOCK = is(env.ADBLOCK);
const CI = is(env.CI);
const COLOR = is(env.npm_config_color);
const DISABLE_OPENCOLLECTIVE = is(env.DISABLE_OPENCOLLECTIVE);
const SILENT = !!~['silent', 'error', 'warn'].indexOf(env.npm_config_loglevel);

function is(it) {
    return !!it && it !== '0' && it !== 'false';
}

function log(it) {
    // eslint-disable-next-line no-console,no-control-regex
    console.log(it);
}

if (!ADBLOCK && !CI && !DISABLE_OPENCOLLECTIVE && !SILENT) {
    log('安装完成');
}