import os from 'os';

export function getPlatform(): string {
  // darwin and linux match already
  // freebsd not supported yet but future proofed.

  // 'aix', 'darwin', 'freebsd', 'linux', 'openbsd', 'sunos', and 'win32'
  let plat: string = os.platform();

  // https://support.torproject.org/tbb/tbb-31/
  // https://dist.torproject.org/torbrowser/
  // wants 'osx', 'linux', 'win'
  // default is linux
  if (plat === 'win32') {
    plat = 'windows';
  }
  switch (plat) {
    case 'darwin':
      plat = 'osx';
      break;
    case 'win32':
      plat = 'win';
      break;
    default:
      plat = 'linux';
      break;
  }

  return plat;
}

export function getArch(): string {
  // 'arm', 'arm64', 'ia32', 'mips', 'mipsel', 'ppc', 'ppc64', 's390', 's390x', 'x32', and 'x64'.
  let arch: string = os.arch();

  // wants '64' and '32', default is '64'
  switch (arch) {
    case 'x64':
      arch = '64';
      break;
    case 'x32':
      arch = '32';
      break;
    default:
      arch = '64';
      break;
  }

  return arch;
}
