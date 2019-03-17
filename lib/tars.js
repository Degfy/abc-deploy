const urllib = require('urllib');
const formstream = require('formstream');
const sleep = require('./tools').sleep;

class Tars {
    constructor(appName, moduleName, cookies, baseUrl = 'http://172.19.249.29:3000') {
        this.appName = appName;
        this.moduleName = moduleName;
        this.cookies = cookies;
        this.baseUrl = baseUrl;
    }

    // 获取服务器节点
    async getServerList() {
        const url = `${this.baseUrl}/pages/server/api/server_list?tree_node_id=1${this.appName}.5${this.moduleName}`;
        const rst = await urllib.request(url, {
            method: 'GET',
            dataType: 'json',
            headers: { Cookie: this.cookies },
        });

        const list = rst && rst.data && rst.data.data;
        if (!list) {
            const err = new Error('error');
            err.info = rst;
            throw err;
        }

        for (let i = 0; i < list.length; i++) {
            const it = list[i];
            it.serveInfo = await this.getServerNodeInfo(it.id);
        }
        return list;
    }

    // 获取服务节点信息：服务的ip以及端口
    async getServerNodeInfo(serverNodeId) {
        const url = `${this.baseUrl}/pages/server/api/adapter_conf_list?id=${serverNodeId}`;

        const rst = await urllib.request(url, {
            method: 'GET',
            dataType: 'json',
            headers: { Cookie: this.cookies },
        });

        const [info] = rst && rst.data && rst.data.data;

        if (info && info.endpoint) {
            let avgs = info.endpoint.split(/\s/).filter(it => it).slice(1);
            avgs = require('yargs-parser')(avgs);
            return {
                ip: avgs.h,
                port: avgs.p,
            };
        }
    }

    // 上传服务代码
    async upload(filepath, comment) {
        const url = `${this.baseUrl}/pages/server/api/upload_patch_package`;
        const form = formstream();
        form.field('task_id', Date.now());
        form.file('suse', filepath);
        form.field('application', this.appName);
        form.field('module_name', this.moduleName);
        form.field('comment', comment);

        let res = await urllib.request(url, {
            method: 'POST',
            headers: {
                ...form.headers(),
                Cookie: this.cookies,
            },
            stream: form,
            timeout: 10 * 60 * 1000,
            dataType: 'json',
        });
        res = res && res.data;

        if (res.ret_code !== 200) {
            console.error(res);
            throw Error('上传失败');
        }

        console.log('代码包上传成功');
        return res.data.id;
    }

    // 发布服务
    async publish(patchId, mark, balance) {
        const list = await this.getServerList();

        // 开启 会话保持
        if (balance) {
            await balance.keepOn();
        }

        for (let i = 0; i < list.length; i++) {
            const it = list[i];

            // 将节点从 负载均衡中移除
            if (balance) {
                await balance.remove(it.serveInfo);
            }

            console.log('发布节点:', it.serveInfo);
            await this.publicOneNode(it.id, patchId, mark);

            // 将节点再次加入到 负载均衡中
            if (balance) {
                await balance.add(it.serveInfo);
            }
        }

        // 关闭会话保持
        if (balance) {
            balance.keepOff();
        }
        console.log('成功发布');
    }

    /**
     * 在tars上发布某个节点
     *
     * @param   {[type]}  serverNodeId  [serverNodeId description]
     * @param   {[type]}  patchId       [patchId description]
     * @param   {[type]}  mark          [mark description]
     * @param   {[type]}  tryTimes      [tryTimes description]
     *
     * @return  {[type]}                [return description]
     */
    async publicOneNode(serverNodeId, patchId, mark, tryTimes = 30) {
        console.log('serverNodeId:', serverNodeId);
        const url = `${this.baseUrl}/pages/server/api/add_task`;
        const res = await urllib.request(url, {
            method: 'POST',
            data: {
                serial: true,
                items: [{
                    server_id: serverNodeId,
                    command: "patch_tars",
                    parameters: {
                        patch_id: patchId,
                        bak_flag: false,
                        update_text: mark,
                    }
                }],
            },
            contentType: 'json',
            dataType: 'json',
            headers: { Cookie: this.cookies },
        });

        if (res.data.ret_code !== 200) {
            console.error(res);
            throw Error('命令提交异常');
        }
        console.log('==>发布命令已经提交了,taskId=%s', res.data.data);

        const taskId = res.data.data;
        while (tryTimes--) {
            let rst = await urllib.request(`${this.baseUrl}/pages/server/api/task?task_no=${taskId}`, {
                method: 'GET',
                dataType: 'json',
                headers: { Cookie: this.cookies },
            });

            if (rst.data.data.status === 2) {
                return rst && rst.data;
            }

            if (rst.data.data.status !== 1) {
                console.error(JSON.stringify(rst.data, '', ' '));
                throw Error('发布失败');
            }
            console.log('...');
            await sleep(1000);
        }

        throw Error('发布超时，发布失败');
    }
}

module.exports = Tars;