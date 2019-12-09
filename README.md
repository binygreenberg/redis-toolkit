# Redis Toolkit

Collection of some useful Redis tools. Currently `analyze` and `delete`.  

## Install
```
npm install -g redis-toolkit
```

## Examples
```
> rt analyze -s 100 --patterns 'user:* client:*'
╔════════════╤═══════╤═════════╤═══════════════╤═════════╤═══════════╗
║ Key        │ Count │ % of DB │ Size in Bytes │ % of DB │ Mean Size ║
╟────────────┼───────┼─────────┼───────────────┼─────────┼───────────╢
║ /user:*/   │ 81    │ 81.00   │ 14542         │ 40.17   │ 179.53    ║
╟────────────┼───────┼─────────┼───────────────┼─────────┼───────────╢
║ /client:*/ │ 8     │ 8.00    │ 530           │ 1.46    │ 66.25     ║
╟────────────┼───────┼─────────┼───────────────┼─────────┼───────────╢
║ other keys │ 11    │ 11.00   │ 21131         │ 58.37   │ 1921.00   ║
╚════════════╧═══════╧═════════╧═══════════════╧═════════╧═══════════╝

> rt delete --pattern 'user:worker:*'
successfully deleted 43 keys matching pattern "user:worker:*"
```

## Usage manual

```
Usage: rt [global flags] <command> [command flags]

global flags:
  -h --host : string
    	Redis Host (default localhost)
  -p --port : number
    	Redis Port (default 6379)

analyze command:
  -s --sample-size : number
    	Number of keys to analyze
  -b --batch-size : number
    	Size of batch (default: 100)
  --patterns : string
    	one or more key patterns to analyze

delete command:
  --pattern : pattern  
        key pattern to delete
```

#### `--host`
Specifies Redis Host to connect to. default: localhost
#### `--port`
Specifies Redis Port to connect to. default: 6379
### `analyze` command
Samples <--sample-size> keys matching <--patterns> using [randomkey](https://redis.io/commands/randomkey)
and measures the [size](https://redis.io/commands/memory-usage) of each pattern.   
#### `--sample-size`
Number of keys to sample. Obviously the more keys the better the confidence level. 
There are plenty of sample size calculator out there, [like this](https://www.surveymonkey.com/mp/sample-size-calculator/).
#### `--batch-size`
[see here](https://github.com/NodeRedis/node_redis) for more details. default: 100
#### `--patterns`
List of one or more key patterns to analyze. default: analyzes the pattern `key_prefix:* `
### `delete` command
[Scans](https://redis.io/commands/scan) the DB and deletes the keys that match the pattern. The delete is done asynchronously using [unlinks](https://redis.io/commands/unlink).
#### `--batch-size`
scans the DB <--batch-size> at a time. default: 10

## Contributions
This being my first open source node project I'd really appreciate any feedback, PR's, or suggestions to improve this CLI 😊

