const dotenv = require('dotenv');
// Retrieves config from .env file and assigns it to the process.env
dotenv.config();

const SRC_PATH = '../src';
const ENVS = {
    DEV: 'dev',
    BETA: 'beta',
    RELEASE: 'release',
};

const BROWSERS = {
    CHROME: 'chrome',
    FIREFOX: 'firefox',
    EDGE: 'edge',
    OPERA: 'opera',
};

// Used only to change output filenames
const STAGE_ENVS = {
    TEST: 'test',
    PROD: 'prod',
};

const ENV_MAP = {
    [ENVS.DEV]: { outputPath: 'dev', name: 'Dev' },
    [ENVS.BETA]: { outputPath: 'beta', name: 'Beta' },
    [ENVS.RELEASE]: { outputPath: 'release', name: '' },
};

const { BUILD_ENV, STAGE_ENV } = process.env;

const IS_DEV = BUILD_ENV ? BUILD_ENV === ENVS.DEV : true;

// Build output path
const BUILD_PATH = '../build';
const CRX_NAME = 'chrome.crx';
const XPI_NAME = 'firefox.xpi';
const CHROME_UPDATER_FILENAME = 'update.xml';
const FIREFOX_UPDATER_FILENAME = 'update.json';
const MANIFEST_NAME = 'manifest.json';

// Chrome CRX certificate paths
const CERTIFICATE_PATHS = {
    beta: './private/AdguardVPN/certificate-beta.pem',
    release: './private/AdguardVPN/certificate-release.pem',
};

const deployPath = process.env.BUILD_ENV || ENVS.DEV;

// Update manifest URL for the Chrome extension
const CHROME_UPDATE_URL = `https://static.adguardvpn.com/extensions/adguardvpn/${deployPath}/${CHROME_UPDATER_FILENAME}`;

// Update manifest URL for the Firefox add-on
const FIREFOX_UPDATE_URL = `https://static.adguardvpn.com/extensions/adguardvpn/${deployPath}/${FIREFOX_UPDATER_FILENAME}`;

// Path to the Chrome CRX (that we'll add to the update manifest)
const CHROME_UPDATE_CRX = `https://static.adguardvpn.com/extensions/adguardvpn/${deployPath}/${CRX_NAME}`;

// Path to the Firefox XPI (that we'll add to the update manifest)
const FIREFOX_UPDATE_XPI = `https://static.adguardvpn.com/extensions/adguardvpn/${deployPath}/${XPI_NAME}`;

module.exports = {
    ENV_MAP,
    SRC_PATH,
    IS_DEV,
    ENVS,
    BUILD_ENV,
    BUILD_PATH,
    CERTIFICATE_PATHS,
    CRX_NAME,
    XPI_NAME,
    CHROME_UPDATER_FILENAME,
    FIREFOX_UPDATER_FILENAME,
    MANIFEST_NAME,
    CHROME_UPDATE_URL,
    FIREFOX_UPDATE_URL,
    CHROME_UPDATE_CRX,
    FIREFOX_UPDATE_XPI,
    STAGE_ENV,
    BROWSERS,
    STAGE_ENVS,
};
