# Redis Toolkit

Collection of some useful Redis tools. Currently `analyze` and `delete`

## Contributions
This being my first open source node project I'd really appreciate any feedback, PR's, or suggestions to improve this CLI 

## Install
```
npm install -g redis-toolkit
```

## Examples
```
> rt analyze -s 10000 --patterns 'dfi:* sec:*'
╔════════════╤═══════╤═════════╤═══════════════╤═════════╤═══════════╗
║ Key        │ Count │ % of DB │ Size in Bytes │ % of DB │ Mean Size ║
╟────────────┼───────┼─────────┼───────────────┼─────────┼───────────╢
║ /dfi:*/    │ 81    │ 81.00   │ 14542         │ 40.17   │ 179.53    ║
╟────────────┼───────┼─────────┼───────────────┼─────────┼───────────╢
║ /sec:*/    │ 8     │ 8.00    │ 530           │ 1.46    │ 66.25     ║
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
    	Requests body file
  -b --batch-size : number
    	size 
  --patterns : string
    	one or more key patterns to analyze

delete command:
  --pattern : pattern  
        key pattern to delete
```

#### `--host`
Specifies Redis Host to connect to, default: localhost
#### `--port`
Specifies Redis Port to connect to, default: 6379
###`analyze` command
Samples <--sample-size> keys matching <--patterns> option using [randomkey](https://redis.io/commands/randomkey)
And measures the [size](https://redis.io/commands/memory-usage) of each pattern.   
#### `--sample-size`
Number of keys to sample. obviously the more keys the better the confidence level. 
There are plenty of sample size calculator out there, [like this](https://www.surveymonkey.com/mp/sample-size-calculator/).
#### `--batch-size`
[see here](https://github.com/NodeRedis/node_redis) for more details. default: 100
#### `--patterns`
List of one or more key patterns to analyze. 
###`delete` command
[Scans](https://redis.io/commands/scan) the DB and deletes the keys that match the pattern. The delete is done asynchronously using [unlinks](https://redis.io/commands/unlink).   
#### `--batch-size`
scans the DB <--batch-size> at a time. default: 10
