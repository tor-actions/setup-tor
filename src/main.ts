import * as core from '@actions/core';
import * as io from '@actions/io';
import * as installer from './installer';
import path from 'path';
import cp from 'child_process';
import fs from 'fs';
import {URL} from 'url';

export async function run(): Promise<void> {
  try {
    //
    // versionS is optional.  If supplied, install / use from the tool cache
    // If not supplied then problem matchers will still be setup.  Useful for self-hosted.
    //
    let version = core.getInput('tor-version');
    if (!version) {
      version = core.getInput('version');
    }
    version = installer.makeSemver(version);

    // stable will be true unless false is the exact input
    // since getting unstable versions should be explicit
    const stable = (core.getInput('stable') || 'true').toUpperCase() === 'TRUE';

    core.info(`Setup tor ${stable ? 'stable' : ''} version ${version}`);

    if (version) {
      const token = core.getInput('token');
      const auth = !token || isGhes() ? undefined : `token ${token}`;

      const installDir = await installer.getTor(version, stable, auth);
      core.debug('Installed directory ' + installDir);

      const torHome = './bin';
      const binPath = path.join('installDir', torHome);
      // core.exportVariable('LD_LIBRARY_PATH', binPath);
      core.addPath(path.join(installDir, 'bin'));
      core.addPath(path.join(binPath, 'bin'));
      core.info('Added tor to the path');

      core.info(`Successfully setup tor version ${version}`);
    }

    // add problem matchers
    const matchersPath = path.join(__dirname, '..', 'matchers.json');
    core.info(`##[add-matcher]${matchersPath}`);

    // output the version actually being used
    const torPath = await io.which('tor');
    const torVersion = (cp.execSync(`${torPath} --version`) || '').toString();
    core.info(torVersion);
  } catch (error) {
    core.setFailed(error.message);
  }
}

function isGhes(): boolean {
  const ghUrl = new URL(
    process.env['GITHUB_SERVER_URL'] || 'https://github.com'
  );
  return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM';
}
