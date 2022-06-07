# @gulujs/ensure-esm-import-explicit

Ensure that import path is a full path to a module.


To avoid adding `--experimental-specifier-resolution=node` flag, we should provide a full path to the loader. (see: [Customizing ESM specifier resolution algorithm](https://nodejs.org/dist/latest-v16.x/docs/api/esm.html#customizing-esm-specifier-resolution-algorithm))

## Installation

```sh
npm i @gulujs/ensure-esm-import-explicit
```

## Usage

```sh
ensure-esm-import-explicit --source ./dist --in-place
```

## License

[MIT](LICENSE)
