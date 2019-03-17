const path = require('path');
const Tars = require('../lib/tars');
const LBS = require('../lib/lbs');

let argv = require('yargs')
    .usage('使用方法: node dep.js ')
    .demand(['h', 'k', 'a', 'm', 'f', 'c'])
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

    const accessKeyId = argv.i && argv.i.trim();
    const accessKeySecret = argv.s && argv.s.trim();

    const LoadBalancerId = argv.b && argv.b.trim();
    const ListenerPort = argv.l && argv.l.trim();

    const VServerGroupId = argv.v && argv.v.trim();
    const publishComment = argv.r && argv.r.trim();

    const tars = new Tars(appName, moduleName, Cookie, BaseUrl);
    const patchId = await tars.upload(path.resolve(process.cwd(), filePath), uploadComment);

    console.log('patchId:', patchId);


    let blance
    if (accessKeyId && accessKeySecret) {
        const lbs = new LBS(accessKeyId, accessKeySecret);
        blance = {
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
                if (VServerGroupId) {
                    await lbs.removeMachine(VServerGroupId, ip, port);
                }
            },

            async add({ ip, port }) {
                if (VServerGroupId) {
                    await lbs.addMachine(VServerGroupId, ip, port);
                }
            },
        };
    }

    await tars.publish(patchId, publishComment, blance);

    process.exit();
}

main().catch(err => {
    console.error(err);
    process.exit(-1);
});