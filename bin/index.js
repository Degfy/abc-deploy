const path = require('path');
const Tars = require('../lib/tars');
const LBS = require('../lib/lbs');

let argv = require('yargs')
    .usage('使用方法: node dep.js ')
    .demand(['h', 'k', 'a', 'm', 'f', 'c', 'i', 's', 'v', 'r'])
    .describe('h', '服务地址,格式domain、http://domain、https://domain')
    .describe('k', 'tars鉴权的cookie')

    .describe('a', '待发布的应用名')
    .describe('m', '待发布应用的模块名')

    .describe('f', '待发布的文件路径')
    .describe('c', '上传时的备注')
    .describe('r', '发布时的备注')

    .describe('i', 'aliyun accessKeyId,阿里云账号keyId')
    .describe('s', 'aliyun accessKeySecret,阿里云账号秘钥')

    .describe('b', '负载均衡id')
    .describe('l', '监听的端口')
    .describe('v', '虚拟服务器组')
    .argv

async function main() {
    const BaseUrl = argv.h.trim(); // 必传
    const Cookie = argv.k.trim(); // 必传

    const appName = argv.a.trim(); // 必传
    const moduleName = argv.m.trim(); //必传

    const filePath = argv.f.trim(); // 必传
    const uploadComment = argv.r.trim(); // 必传

    const accessKeyId = argv.i.trim(); // 必传
    const accessKeySecret = argv.s.trim(); //必传


    const LoadBalancerId = argv.b.trim(); //必传
    const ListenerPort = argv.l.trim(); // 必传

    const VServerGroupId = argv.v.trim(); // 必传
    const publishComment = argv.r.trim(); //必传

    const tars = new Tars(appName, moduleName, Cookie, BaseUrl);
    const patchId = await tars.upload(path.resolve(__dirname, filePath), uploadComment);

    console.log('patchId:', patchId);

    const lbs = new LBS(accessKeyId, accessKeySecret);

    await tars.publish(patchId, publishComment, {
        async keepOn() {
            if (LoadBalancerId && ListenerPort) {
                await lbs.turnOnStickySession(LoadBalancerId, ListenerPort);
            }
        },

        async keepOff() {
            if (LoadBalancerId && ListenerPort) {
                await lbs.turnOffStickySession(LoadBalancerId, ListenerPort);
            }
        },

        async remove({ ip, port }) {
            await lbs.removeMachine(VServerGroupId, ip, port);
        },

        async add({ ip, port }) {
            await lbs.addMachine(VServerGroupId, ip, port);
        },
    });

    process.exit();
}

main().catch(err => {
    console.error(err);
    process.exit(-1);
});