const Core = require('@alicloud/pop-core');

class LBS {
    constructor(accessKeyId, accessKeySecret) {
        this.accessKeyId = accessKeyId;
        this.accessKeySecret = accessKeySecret;

        this.client = new Core({
            accessKeyId,
            accessKeySecret,
            endpoint: 'https://slb.aliyuncs.com',
            apiVersion: '2014-05-15',
        });
    }

    // 1. 开启 会话保持
    async turnOnStickySession(LoadBalancerId, ListenerPort, RegionId = 'cn-shanghai') {
        return await this.client.request('SetLoadBalancerHTTPListenerAttribute', {
            RegionId,
            ListenerPort,
            LoadBalancerId,
            StickySession: 'on',
            StickySessionType: 'insert',
            CookieTimeout: 600,
        }, { method: 'POST', });
    }

    // 2. 关闭 会话保持
    async turnOffStickySession(LoadBalancerId, ListenerPort, RegionId = 'cn-shanghai') {
        return await this.client.request('SetLoadBalancerHTTPListenerAttribute', {
            RegionId,
            ListenerPort,
            LoadBalancerId,
            StickySession: 'off',
        }, { method: 'POST', });
    }

    // 3. 添加虚拟服务器
    async addMachine(VServerGroupId, ip, port) {
        const machine = await this.getMachineByIp(ip);

        if (!machine) {
            throw Error(`${ip}服务器不存在`);
        }

        const rst = await this.client.request('AddVServerGroupBackendServers', {
            RegionId: machine.RegionId,
            VServerGroupId,
            BackendServers: JSON.stringify([{
                ServerId: machine.InstanceId,
                Port: port,
            }]),
        }, { method: 'POST' });

        console.log(JSON.stringify(rst, '', ' '));

        return rst;

    }

    // 4. 删除虚拟服务器
    async removeMachine(VServerGroupId, ip, port) {
        const machine = await this.getMachineByIp(ip);

        if (!machine) {
            throw Error(`${ip}服务器不存在`);
        }

        const rst = await this.client.request('RemoveVServerGroupBackendServers', {
            RegionId: machine.RegionId,
            VServerGroupId,
            BackendServers: JSON.stringify([{
                ServerId: machine.InstanceId,
                Port: port,
            }]),
        }, { method: 'POST' });

        console.log(JSON.stringify(rst, '', ' '));

        return rst;
    }

    // 5. 获取服务器列表
    async getListMachine(RegionId = 'cn-shanghai') {
        if (!this._list) {
            let client = new Core({
                accessKeyId: this.accessKeyId,
                accessKeySecret: this.accessKeySecret,
                endpoint: 'https://ecs.aliyuncs.com',
                apiVersion: '2014-05-26'
            });

            const rst = await client.request('DescribeInstances', {
                RegionId,
                Status: 'Running',
            }, { method: 'POST' });

            const list = rst.Instances.Instance.map(it => {
                return {
                    RegionId: it.RegionId,
                    InstanceId: it.InstanceId,
                    PrivateIp: it.VpcAttributes.PrivateIpAddress.IpAddress[0],
                };
            });
            this._list = list;
            this._listMap = new Map;
            list.forEach(it => {
                this._listMap.set(it.PrivateIp, it);
            });
        }
        return this._list;
    }

    async getMachineByIp(ip) {
        if (!this._listMap) {
            await this.getListMachine();
        }

        return this._listMap.get(ip);
    }
}

module.exports = LBS;