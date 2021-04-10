import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import cp from 'child_process';
import osm from 'os';
import path from 'path';
import * as main from '../src/main';
import * as im from '../src/installer';

const matchers = require('../matchers.json');
const torTestManifest = require('./data/versions-manifest.json');
const matcherPattern = matchers.problemMatcher[0].pattern[0];
const matcherRegExp = new RegExp(matcherPattern.regexp);

describe('setup-tor', () => {
  let inputs = {} as any;
  let os = {} as any;

  let inSpy: jest.SpyInstance;
  let findSpy: jest.SpyInstance;
  let cnSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let getSpy: jest.SpyInstance;
  let platSpy: jest.SpyInstance;
  let archSpy: jest.SpyInstance;
  let dlSpy: jest.SpyInstance;
  let exSpy: jest.SpyInstance;
  let cacheSpy: jest.SpyInstance;
  let dbgSpy: jest.SpyInstance;
  let whichSpy: jest.SpyInstance;
  let existsSpy: jest.SpyInstance;
  let mkdirpSpy: jest.SpyInstance;
  let execSpy: jest.SpyInstance;
  let getManifestSpy: jest.SpyInstance;

  beforeAll(() => {
    process.env['GITHUB_PATH'] = ''; // Stub out ENV file functionality so we can verify it writes to standard out
    process.env['RUNNER_TEMP'] = path.join(process.cwd(), '.tmp');
    console.log('::stop-commands::stoptoken'); // Disable executing of runner commands when running tests in actions
  });

  beforeEach(() => {
    // @actions/core
    inputs = {};
    inSpy = jest.spyOn(core, 'getInput');
    inSpy.mockImplementation(name => inputs[name]);

    // node
    os = {};
    platSpy = jest.spyOn(osm, 'platform');
    platSpy.mockImplementation(() => os['platform']);
    archSpy = jest.spyOn(osm, 'arch');
    archSpy.mockImplementation(() => os['arch']);
    execSpy = jest.spyOn(cp, 'execSync');

    // @actions/tool-cache
    findSpy = jest.spyOn(tc, 'find');
    dlSpy = jest.spyOn(tc, 'downloadTool');
    exSpy = jest.spyOn(tc, 'extractTar');
    cacheSpy = jest.spyOn(tc, 'cacheDir');
    getManifestSpy = jest.spyOn(tc, 'getManifestFromRepo');

    // io
    whichSpy = jest.spyOn(io, 'which');
    existsSpy = jest.spyOn(fs, 'existsSync');
    mkdirpSpy = jest.spyOn(io, 'mkdirP');

    // gets
    getManifestSpy.mockImplementation(() => <tc.IToolRelease[]>torTestManifest);

    // writes
    cnSpy = jest.spyOn(process.stdout, 'write');
    logSpy = jest.spyOn(core, 'info');
    dbgSpy = jest.spyOn(core, 'debug');
    cnSpy.mockImplementation(line => {
      // uncomment to debug
      // process.stderr.write('write:' + line + '\n');
    });
    logSpy.mockImplementation(line => {
      // uncomment to debug
      // process.stderr.write('log:' + line + '\n');
    });
    dbgSpy.mockImplementation(msg => {
      // uncomment to see debug output
      // process.stderr.write(msg + '\n');
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    //jest.restoreAllMocks();
  });

  afterAll(async () => {
    console.log('::stoptoken::'); // Re-enable executing of runner commands when running tests in actions
  }, 100000);

  it('can find 0.4.5-rc7 from manifest on osx', async () => {
    os.platform = 'darwin';
    os.arch = 'x64';

    const match = await im.getInfoFromManifest('0.4.5-rc7', true, 'mocktoken');
    expect(match).toBeDefined();
    expect(match!.resolvedVersion).toBe('0.4.5-rc7');
    expect(match!.type).toBe('manifest');
    expect(match!.downloadUrl).toBe(
      'https://github.com/tor-actions/versions/releases/download/0.4.5.7/tor-darwin-amd64-0.4.5.7.tar.gz'
    );
  });

  it('can find 0.4.5-rc7 from manifest on linux', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    const match = await im.getInfoFromManifest('0.4.5-rc7', true, 'mocktoken');
    expect(match).toBeDefined();
    expect(match!.resolvedVersion).toBe('0.4.5-rc7');
    expect(match!.type).toBe('manifest');
    expect(match!.downloadUrl).toBe(
      'https://github.com/tor-actions/versions/releases/download/0.4.5.7/tor-linux-amd64-0.4.5.7.tar.gz'
    );
  });

  it('can find 0.4.5-rc7 from manifest on windows', async () => {
    os.platform = 'win32';
    os.arch = 'x64';

    const match = await im.getInfoFromManifest('0.4.5-rc7', true, 'mocktoken');
    expect(match).toBeDefined();
    expect(match!.resolvedVersion).toBe('0.4.5-rc7');
    expect(match!.type).toBe('manifest');
    expect(match!.downloadUrl).toBe(
      'https://github.com/tor-actions/versions/releases/download/0.4.5.7/tor-win32-0.4.5.7.tar.gz'
    );
  });

  it('downloads a version not in the cache', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    inputs['tor-version'] = '0.4.5-rc7';

    findSpy.mockImplementation(() => '');
    dlSpy.mockImplementation(() => '/some/temp/path');
    const toolPath = path.normalize('/cache/tor/0.4.5-rc7/x64');
    exSpy.mockImplementation(() => '/some/other/temp/path');
    cacheSpy.mockImplementation(() => toolPath);
    await main.run();

    const expPath = path.join(toolPath, 'bin');

    expect(dlSpy).toHaveBeenCalled();
    expect(exSpy).toHaveBeenCalled();
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  it('downloads a version from a manifest match', async () => {
    os.platform = 'linux';
    os.arch = 'x64';

    // a version which is in the manifest
    const versionSpec = '0.4.5-rc7';

    inputs['tor-version'] = versionSpec;
    inputs['token'] = 'faketoken';

    const expectedUrl =
      'https://github.com/tor-actions/versions/releases/download/0.4.5.7/tor-linux-amd64-0.4.5.7.tar.gz';

    // ... but not in the local cache
    findSpy.mockImplementation(() => '');

    dlSpy.mockImplementation(async () => '/some/temp/path');
    const toolPath = path.normalize('/cache/tor/0.4.5-rc7/x64');
    exSpy.mockImplementation(async () => '/some/other/temp/path');
    cacheSpy.mockImplementation(async () => toolPath);

    await main.run();

    const expPath = path.join(toolPath, 'bin');

    expect(dlSpy).toHaveBeenCalled();
    expect(exSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      `Acquiring ${versionSpec} from ${expectedUrl}`
    );

    expect(logSpy).toHaveBeenCalledWith(
      `Attempting to download ${versionSpec}...`
    );
    expect(cnSpy).toHaveBeenCalledWith(`::add-path::${expPath}${osm.EOL}`);
  });

  interface Annotation {
    file: string;
    line: number;
    column: number;
    message: string;
  }

  // problem matcher regex pattern tests
  function testMatch(line: string): Annotation {
    const annotation = <Annotation>{};

    const match = matcherRegExp.exec(line);
    if (match) {
      annotation.line = parseInt(match[matcherPattern.line], 10);
      annotation.column = parseInt(match[matcherPattern.column], 10);
      annotation.file = match[matcherPattern.file].trim();
      annotation.message = match[matcherPattern.message].trim();
    }

    return annotation;
  }

  // 1.13.1 => 1.13.1
  // 1.13 => 1.13.0
  // 1.10beta1 => 1.10.0-beta1, 1.10rc1 => 1.10.0-rc1
  // 1.8.5beta1 => 1.8.5-beta1, 1.8.5rc1 => 1.8.5-rc1
  // 0.4.5.7 => 0.4.5-rc7
  it('converts prerelease versions', async () => {
    expect(im.makeSemver('1.10beta1')).toBe('1.10.0-beta1');
    expect(im.makeSemver('1.10rc1')).toBe('1.10.0-rc1');
    expect(im.makeSemver('0.4.5.7')).toBe('0.4.5-rc7');
    expect(im.makeSemver('0.4.5-rc7')).toBe('0.4.5-rc7');
  });

  it('converts dot zero versions', async () => {
    expect(im.makeSemver('1.13')).toBe('1.13.0');
  });

  it('does not convert exact versions', async () => {
    expect(im.makeSemver('1.13.1')).toBe('1.13.1');
  });
});
