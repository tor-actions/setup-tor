# setup-tor

[![build-test](https://github.com/wabarc/setup-tor/actions/workflows/workflow.yml/badge.svg)](https://github.com/wabarc/setup-tor/actions/workflows/workflow.yml)

This action sets up a tor environment for use in actions by:

- optionally downloading and caching a version of Tor by version and adding to PATH
- registering problem matchers for error output

# Usage

See [action.yml](action.yml)

Basic:
```yaml
steps:
- uses: actions/checkout@master
- uses: tor-actions/setup-tor@main
  with:
    tor-version: '0.4.5.7' # The Tor version to download (if necessary) and use.
- run: tor
```

Matrix Testing:
```yaml
jobs:
  build:
    runs-on: ubuntu-16.04
    strategy:
      matrix:
        tor: [ '0.4.5.7', '0.4.5-rc7' ]
    name: Tor ${{ matrix.tor }} sample
    steps:
      - uses: actions/checkout@v2
      - name: Setup tor
        uses: tor-actions/setup-tor@v1
        with:
          tor-version: ${{ matrix.tor }}
      - run: tor
```

# License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

# Contributions

Contributions are welcome!  See [Contributor's Guide](docs/contributors.md)

## Code of Conduct

:wave: Be nice.  See [our code of conduct](CODE_OF_CONDUCT.md)
