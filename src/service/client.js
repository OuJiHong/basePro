/**
 * Created by OJH on 2017/8/29.
 * xampp 客户端
 *
 */
import { Strophe, $build, $msg, $iq, $pres } from "strophe.js";

import { Logger , LevelType } from "./logger";

/**
 * 连接状态常量
 *
 Status.ERROR	(发生了一个错误)An error has occurred
 Status.CONNECTING	(当前正在连接)The connection is currently being made
 Status.CONNFAIL	(连接请求失败)The connection attempt failed
 Status.AUTHENTICATING	(连接进行身份验证)The connection is authenticating
 Status.AUTHFAIL	(身份验证请求失败)The authentication attempt failed
 Status.CONNECTED	(连接成功)The connection has succeeded
 Status.DISCONNECTED	(连接已终止)The connection has been terminated
 Status.DISCONNECTING	(目前连接被终止)The connection is currently being terminated
 Status.ATTACHED	(已附加的连接)The connection has been attached
 Status.REDIRECT	(连接被重定向)The connection has been redirected
 Status.CONNTIMEOUT	(连接已超时)The connection has timed out
 *
 *

 LogLevel.DEBUG	Debug output
 LogLevel.INFO	Informational output
 LogLevel.WARN	Warnings
 LogLevel.ERROR	Errors
 LogLevel.FATAL	Fatal errors

 *
 *

 三种特别的片段:XML 节（XML stanzas）

 <message/>
 <presence/>
 <iq/>

 用户可用状态:
 聊天
    说明你有能力，并且积极寻求谈话（可能你十分善于社交）
 离开
    表明你暂时离开了 IM 客户端、电脑、或者设备一段时间，这个状态经常是不通过手动
    操作进行的，通过“自动离开”功能即可实现，现在许多 IM 客户端都有这个功能。
 长时间离开
    说明你要离开更长的一段时间，你的 IM 客户端同样可以自动实现这个功能。
 忙碌
    说明你现在很忙并不希望被打扰
 *
 *
 */

//配置
const serverHost = "openfire.zhongqi.com";
const serverAddress = "http://" + serverHost + ":7070/http-bind/";


const logger = new Logger("client");

const stropheJsLogger = new Logger("strophe.js", LevelType.error);
//日志重写
let LogLevel = Strophe.LogLevel;
//重写log函数，提供日志输出
Strophe.log = function(level, msg){
    switch(level){
        case LogLevel.INFO:
            stropheJsLogger.info(msg);
            break;
        case LogLevel.DEBUG:
            stropheJsLogger.debug(msg);
            break;
        case LogLevel.WARN:
            stropheJsLogger.warn(msg);
            break;
        case LogLevel.ERROR:
            stropheJsLogger.error(msg);
            break;
        case LogLevel.FATAL:
            stropheJsLogger.fatal(msg);
            break;
        default:
            stropheJsLogger.log(msg);
    }
}


const eventType = {
    message:"message",
    connectSuccess:"connectSuccess",
    connectStatusChange:"connectStatusChange",
    connectError:"connectError",
    disconnect:"disconnect",
    userStatusChange:"userStatusChange"
};

//连接状态翻译
const Status = Strophe.Status;
const statusMap = {

};
statusMap[Status.ERROR] = "发生了一个错误";
statusMap[Status.CONNECTING] = "当前正在连接";
statusMap[Status.CONNFAIL] = "连接请求失败";
statusMap[Status.AUTHENTICATING] = "连接进行身份验证";
statusMap[Status.AUTHFAIL] = "身份验证请求失败";
statusMap[Status.CONNECTED] = "连接成功";
statusMap[Status.DISCONNECTED] = "连接已终止";
statusMap[Status.DISCONNECTING] = "目前连接被终止";
statusMap[Status.ATTACHED] = "已附加的连接";
statusMap[Status.REDIRECT] = "连接被重定向";
statusMap[Status.CONNTIMEOUT] = "连接已超时";

//可用聊天状态
const chatStatusMap = {
    starting:"尚未参与",
    active:"正在关注",
    composing:"正在组织消息",
    paused:"停止组织消息",
    inactive:"未参与",
    gone:"结束"
};

//可用的用户状态
const userStatusMap = {
    online:{show:"available", status:"上线"},
    leave:{show:"away", status:"离开"},
    dnd:{show:"do not disturb", status:"忙碌"},
    offline:{show:"unavailable", status:"下线"}
};


//添加命名空间
Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');
Strophe.addNamespace('XFORM', 'jabber:x:data');


function Client(username, password){

    if(this instanceof Client){
        this._cacheEventMap = {};

        this.username = username;
        this.password = password;

        //创建一个连接对象
        this.connection = new Strophe.Connection(serverAddress, {});

        //初始化
        let ns = "";
        let name = null;
        let type = "error";
        let id = null;
        let from = null;
        let options = {
            keepalive:true
        };

        let handlerAll = this.connection.addHandler(function(stanzas){
            logger.debug(stanzas);
        }, ns, name, type, id, from ,options);


        //连接
        this.connect();

    }else{
        throw new Error("Please use the new  Client  object creation");
    }

}

//缓存事件处理函数
Client.prototype._cacheEventMap  = null;


Client.prototype.generateResource = function () {
    return '/client-' + Math.floor(Math.random()*139749825).toString();
};


/**
 * 建立连接
 * @returns
 */
Client.prototype.connect = function(){
    var _this = this;
    var connection = this.connection;
    //重置连接，以便重复利用
    connection.reset();


    var resource = Strophe.getResourceFromJid(this.username);
    if(!resource){
        resource = this.generateResource();
    }

    var jid = Strophe.getBareJidFromJid(this.username).toLowerCase()  + "@" + serverHost;
    var pass = this.password;//密码可选

    //回调处理状态
    var callback = function(status){
        if(status == Strophe.Status.CONNECTED  || status === Strophe.Status.ATTACHED){
            //连接成功
            _this.setUserStatus();//初始化用户在线状态

            let successMsg = statusMap[status];
            _this.trigger(eventType.connectSuccess, connection, [status, successMsg]);

            //设置别名
            _this.authzid = connection.authzid;//授权标识
            _this.authcid = connection.authcid;//认证标识（用户名称）
            _this.pass = connection.pass;//认证标识（密码）
            _this.servtype = connection.servtype;//服务类型（MD5）

        }else if(status == Status.ERROR || status == Status.AUTHFAIL || status == Status.CONNFAIL || status == Status.CONNTIMEOUT){
            let errorMsg = statusMap[status];
            _this.trigger(eventType.connectError, connection, [status, errorMsg]);
        }else if(status == Status.DISCONNECTED){
            let errorMsg = statusMap[status];
            _this.trigger(eventType.disconnect, connection, [status, errorMsg]);
        }

        //连接状态改变
        let statusMsg = statusMap[status];
        _this.trigger(eventType.connectStatusChange, connection, [status, statusMsg]);
    };

    var wait = 9;//超时时间
    var hold = null;
    var route = null;
    var authcid = null;

    //connection.connect(jid, pass, callback, wait, hold, route, authcid);

    connection.connect(jid, pass, callback, wait);

    return this;

};

/**
 * 断开连接
 * @param reason
 * @returns {Client}
 */
Client.prototype.disconnect = function(reason){

    this.connection.disconnect(reason);

    return this;
};

/**
 * 发送消息
 * @param jid 目标用户
 * @param status 聊天状态
 * @param msg 消息字符串
 * @returns {Client}
 *
 消息类型（type）：
 normal (默认值)立即被传递或被服务器离线存储
 chat 消息类型在“聊天会话”中通常在相对短的时间内以突发消息发送。即时消息客
 户端在一对一的对话界面中显示这些信息。
 groupchat 产生一个向外的消息给房间的每一个人
 headline 消息通常不被离线存储，因为他们是临时性的。
 error 类型的消息是为了应答先前发送的消息而被发送出去，以指示和先前消息有关的
 错误发送（接收人不出席，此时不能发送消息等） 。

 *
 */
Client.prototype.sendMessage = function(jid, status, msg){
    if(jid == null || status == null){
        logger.error("未指定jid或者status");
        return this;
    }

    let type = "chat";//一对一聊天
    let msgObj = $msg({from:this.authcid, to:jid, type:type});
    if(msg != null){
        msgObj.root();
        msgObj.c("body", null, msg);
    }

    msgObj = this.addChatStatus(msgObj, status, type);

    this.connection.send(msgObj);

    return this;
};

/**
 *
 * @param msgObj 构建好的消息对象
 * @param status
 * @param type
 * @returns
 *
 聊天状态描述了你所参与的对话，可以是以下状态之一：
 starting
 某人开始一个对话，但是你还没有参与进来。
 active
 你正参与在对话中。当前你没有组织你的消息，而是在关注。
 composing
 你正在组织一个消息。
 paused
 你开始组织一个消息，但由于某个原因而停止组织消息。
 inactive
 你一段时间里没有参与这个对话。
 gone
 你参与的这个对话已经结束（例如，你关闭了聊天窗口） 。

 xmlns:http://jabber.org/protocol/chatstate
 *
 */
Client.prototype.addChatStatus = function(msgObj, status, type){
    if(msgObj == null || status == null){
        logger.error("未指定msgObj或者status");
        return this;
    }
    //添加状态元素
    let statusObj= chatStatusMap[status];
    if(statusObj != null) {
        msgObj.root();
        msgObj.c(status);
    }

    return msgObj;
};


/**
 * 设置用户状态，
 * 发送一个初始化的"出席节"到服务器，服务器会通知每一个订阅自己的每一个人
 *
 * 优先级：<priority/>
 *
 */
Client.prototype.setUserStatus = function(status){
    var _this = this;
    var changeTimeout = 6;//超时时间
    var connection = this.connection;
    if(status == null){
        var emptyPresence = $pres();//构建一个空的presence元素
        this.connection.send(emptyPresence.tree());
    }else{
        var statusObj = status;
        if(typeof status == "string"){
            statusObj = userStatusMap[status];
        }

        //改变状态
        var presence = $pres();
        for(var key in statusObj){
            presence.root();
            presence.c(key).t(statusObj[key]);//添加子节点，然后设置节点内容
        }
        //发送出席状态
        connection.sendPresence(presence, function(stanza){
            //success
            _this.trigger(eventType.userStatusChange, connection, ["success", stanza]);
        }, function(stanza){
            //error
            if(stanza == null){
                //表示超时
                _this.trigger(eventType.userStatusChange, connection, ["error", stanza]);
            }else{
                _this.trigger(eventType.userStatusChange, connection, ["timeout", stanza]);
            }
        }, changeTimeout);
    }


};


/**
 * 添加事件处理
 * @param name
 * @param handler
 * @returns {Client}
 */
Client.prototype.on = function(name, handler){

    var eventMap = this._cacheEventMap;
    if(name != null && typeof handler == "function"){
        var handlerAry = eventMap[name];
        if(handlerAry == null){
            handlerAry = [];
            eventMap[name] = handlerAry;
        }
        handlerAry.push(handler);
    }

    return this;
};

/**
 * 移除事件处理
 * @param name
 * @returns {Client}
 */
Client.prototype.off = function(name){
    var eventMap = this._cacheEventMap;
    var count = 0;
    if(name != null){
        var handlerAry = eventMap[name];
        if(handlerAry != null){
            count = handlerAry.length;
            delete eventMap[name];
        }

    }

    return this;
};

/**
 *  触发处理函数
 * @param name
 * @returns {Client}
 */
Client.prototype.trigger = function(name, thisArg, args){
    var eventMap = this._cacheEventMap;
    var count = 0;
    if(name != null){
        var handlerAry = eventMap[name];
        if(handlerAry != null){
            for(let i = 0 ; i < handlerAry.length; i++){
                let handler = handlerAry[i];
                handler && handler.apply(thisArg, args);
                count++;
            }

        }

    }

    return this;

};

Client.prototype.onMessage = function(handler){
    this.on(eventType.message, handler);
    return this;
};

Client.prototype.onConnectSuccess = function(handler){
    this.on(eventType.connectSuccess, handler);
    return this;
};

Client.prototype.onConnectStatusChange = function(handler){
    this.on(eventType.connectStatusChange, handler);
    return this;
}

Client.prototype.onConnectError = function(handler){
    this.on(eventType.connectError, handler);
    return this;
};

Client.prototype.onDisConnect = function(handler){
    this.on(eventType.disconnect, handler);
    return this;
};

Client.prototype.onUserStatusChange = function(handler){
    this.on(eventType.userStatusChange, handler);
    return this;
};


/**
 * 导出客户端
 */
export {
    Client,
    userStatusMap
};
