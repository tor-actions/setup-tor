import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as path from 'path';
import * as semver from 'semver';
// import * as httpm from '@actions/http-client';
import * as sys from './system';
import os from 'os';

type InstallationType = 'dist' | 'manifest';

export interface ITorVersionFile {
  filename: string;
  // darwin, linux, windows
  os: string;
  arch: string;
}

export interface ITorVersion {
  version: string;
  stable: boolean;
  files: ITorVersionFile[];
}

export interface ITorVersionInfo {
  type: InstallationType;
  downloadUrl: string;
  resolvedVersion: string;
  fileName: string;
}

export async function getTor(
  versionSpec: string,
  stable: boolean,
  auth: string | undefined
): Promise<string> {
  const osPlat: string = os.platform();
  const osArch: string = os.arch();

  // check cache
  const toolPath: string = tc.find('tor', versionSpec);
  // If not found in cache, download
  if (toolPath) {
    core.info(`Found in cache @ ${toolPath}`);
    return toolPath;
  }
  core.info(`Attempting to download ${versionSpec}...`);
  let downloadPath = '';
  let info: ITorVersionInfo | null = null;

  //
  // Try download from internal distribution (popular versions only)
  // Repo see https://github.com/tor-actions/versions
  //
  try {
    info = await getInfoFromManifest(versionSpec, stable, auth);
    if (info) {
      downloadPath = await installTorVersion(info, auth);
    } else {
      core.info(
        'Not found in manifest. Falling back to download directly from Tor'
      );
    }
  } catch (err) {
    if (
      err instanceof tc.HTTPError &&
      (err.httpStatusCode === 403 || err.httpStatusCode === 429)
    ) {
      core.info(
        `Received HTTP status code ${err.httpStatusCode}.  This usually indicates the rate limit has been exceeded`
      );
    } else {
      core.info(err.message);
    }
    core.debug(err.stack);
    core.info('Falling back to download directly from Tor');
  }

  return downloadPath;
}

async function installTorVersion(
  info: ITorVersionInfo,
  auth: string | undefined
): Promise<string> {
  core.info(`Acquiring ${info.resolvedVersion} from ${info.downloadUrl}`);
  const downloadPath: string = await tc.downloadTool(
    info.downloadUrl,
    '',
    auth
  );

  core.info('Extracting Tor...');
  let extPath = await extractTorArchive(downloadPath ?? '');
  core.info(`Successfully extracted tor to ${extPath}`);
  if (info.type === 'dist') {
    extPath = path.join(extPath, 'tor');
  }

  core.info('Adding to the cache ...');
  const cachedDir = await tc.cacheDir(
    extPath,
    'tor',
    makeSemver(info.resolvedVersion)
  );
  core.info(`Successfully cached tor to ${cachedDir}`);
  return cachedDir;
}

export async function extractTorArchive(archivePath: string): Promise<string> {
  const osPlat = os.platform();

  let extPath = '';

  // switch (osPlat) {
  //   case 'darwin': {
  //     extPath = await tc.extractTar(archivePath, '', ['xz', '--strip', '1']);
  //     break;
  //   }
  //   case 'linux': {
  //     extPath = await tc.extractTar(archivePath, '', ['xz', '--strip', '1']);
  //     break;
  //   }
  //   case 'win32': {
  //     extPath = await tc.extractTar(archivePath, '', ['xz', '--strip', '1']);
  //     break;
  //   }
  // }
  extPath = await tc.extractTar(archivePath, '', ['xz', '--strip', '1']);

  return extPath;
}

export async function getInfoFromManifest(
  versionSpec: string,
  stable: boolean,
  auth: string | undefined
): Promise<ITorVersionInfo | null> {
  let info: ITorVersionInfo | null = null;
  const releases = await tc.getManifestFromRepo(
    'tor-actions',
    'versions',
    auth,
    'main'
  );
  core.info(`matching ${versionSpec}...`);
  const rel = await tc.findFromManifest(versionSpec, stable, releases);

  if (rel && rel.files.length > 0) {
    info = <ITorVersionInfo>{};
    info.type = 'manifest';
    info.resolvedVersion = rel.version;
    info.downloadUrl = rel.files[0].download_url;
    info.fileName = rel.files[0].filename;
  }

  return info;
}

async function getInfoFromDist(
  versionSpec: string,
  stable: boolean
): Promise<ITorVersionInfo | null> {
  const version: ITorVersion | undefined = await resolveVersionFromManifest(
    versionSpec,
    stable
  );
  if (!version) {
    return null;
  }

  const osArch = sys.getArch();
  const osPlat = sys.getPlatform();

  const downloadUrl = `https://dist.torproject.org/torbrowser/${version.version}/tor-browser-${osPlat}${osArch}-${version.version}_en-US.tar.xz`;

  return <ITorVersionInfo>{
    type: 'dist',
    downloadUrl: downloadUrl,
    resolvedVersion: version.version,
    fileName: version.files[0].filename
  };
}

export async function resolveVersionFromManifest(
  versionSpec: string,
  stable: boolean,
  auth?: string | undefined
): Promise<ITorVersion | undefined> {
  const osPlat: string = os.platform();

  // TODO: resolve from dist
  const version: string = versionSpec || '10.0.15';
  const manifest = [
    {
      version: '10.0.15',
      stable: true,
      files: [
        {
          filename: 'TorBrowser-10.0.15-osx64_en-US.dmg',
          arch: 'x64',
          platform: 'darwin',
          download_url:
            'https://dist.torproject.org/torbrowser/10.0.15/TorBrowser-10.0.15-osx64_en-US.dmg'
        },
        {
          filename: 'tor-browser-linux64-10.0.15_en-US.tar.xz',
          arch: 'x64',
          platform: 'linux',
          download_url:
            'https://dist.torproject.org/torbrowser/10.0.15/tor-browser-linux64-10.0.15_en-US.tar.xz'
        },
        {
          filename: 'torbrowser-install-win64-10.0.15_en-US.exe',
          arch: 'x64',
          platform: 'win32',
          download_url:
            'https://dist.torproject.org/torbrowser/10.0.15/torbrowser-install-win64-10.0.15_en-US.exe'
        }
      ]
    }
  ];
  const files: ITorVersionFile[] = [];
  manifest.forEach(ver => {
    ver.files.forEach(v => {
      if (osPlat === v.platform) {
        files.push({
          filename: v.filename,
          os: v.platform === 'win32' ? 'windows' : v.platform,
          arch: v.arch
        });
      }
    });
  });
  return <ITorVersion>{
    version: version,
    stable: stable,
    files: files
  };
}

//
// Convert the tor version syntax into semver for semver matching
// 1.13.1 => 1.13.1
// 1.13 => 1.13.0
// 1.10beta1 => 1.10.0-beta1, 1.10rc1 => 1.10.0-rc1
// 1.8.5beta1 => 1.8.5-beta1, 1.8.5rc1 => 1.8.5-rc1
// 0.4.5.7 => 0.4.5-rc7
export function makeSemver(version: string): string {
  version = version.replace('tor', '');
  version = version.replace('beta', '-beta').replace('rc', '-rc');
  const parts = version.split('-');

  let verPart: string = parts[0];
  let prereleasePart = parts.length > 1 ? `-${parts[parts.length - 1]}` : '';

  const verParts: string[] = verPart.split('.');
  if (verParts.length == 2) {
    verPart += '.0';
  }
  if (verParts.length === 4) {
    verPart = semver.valid(semver.coerce(version)) || version;
    prereleasePart = '-rc' + verParts[3];
  }

  return `${verPart}${prereleasePart}`.replace(/-$/i, '');
}
