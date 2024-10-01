/*
Tencent is pleased to support the open source community by making Face-2-Face Translator available.

Copyright (C) 2018 THL A29 Limited, a Tencent company. All rights reserved.

Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at
http://opensource.org/licenses/MIT

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
*/
var that = this
const app = getApp()

const util = require('../../utils/util.js')

const plugin = requirePlugin("WechatSI")

import { language } from '../../utils/conf.js'

function formatDateTime() {
  var date = new Date()
  if (!(date instanceof Date)) {
    console.error('参数必须是Date对象');
    return '';
  }
  
  let year = date.getFullYear(); // 获取年份
  let month = date.getMonth() + 1; // 获取月份，月份从0开始计数，所以需要+1
  let day = date.getDate(); // 获取日
  let hours = date.getHours(); // 获取小时
  let minutes = date.getMinutes(); // 获取分钟

  // 补零函数，确保月、日、时、分都是两位数
  function pad(number) {
    return number < 10 ? '0' + number : number;
  }

  // 格式化日期和时间
  return `${year}年${pad(month)}月${pad(day)}日 ${pad(hours)}时${pad(minutes)}分`;
}

// 获取**全局唯一**的语音识别管理器**recordRecoManager**
const manager = plugin.getRecordRecognitionManager()


Page({
  data: {
    dialogList: [
      {
        // 当前语音输入内容
        create: formatDateTime(),
        lfrom: 'zh_CN',
        lto: 'en_US',
        text: '欢迎使用讯飞大模型语音对话',
        translateText: '你好！',
        voicePath: '',
        translateVoicePath: '',
        autoPlay: false, // 自动播放背景音乐
        id: 0,
      },
    ],
    scroll_top: 10000, // 竖向滚动条位置

    bottomButtonDisabled: false, // 底部按钮disabled

    tips_language: language[0], // 目前只有中文

    initTranslate: {
      // 为空时的卡片内容
      create: '04/27 15:37',
      text: '等待说话',
    },

    currentTranslate: {
      // 当前语音输入内容
      create: '04/27 15:37',
      text: '等待说话',
    },
    recording: false,  // 正在录音
    recordStatus: 0,   // 状态： 0 - 录音中 1- 翻译中 2 - 翻译完成/二次翻译

    toView: 'fake',  // 滚动位置
    lastId: -1,    // dialogList 最后一个item的 id
    currentTranslateVoice: '', // 当前播放语音路径

  },


  /**
   * 按住按钮开始语音识别
   */
  streamRecord: function(e) {
    // console.log("streamrecord" ,e)
    let detail = e.detail || {}
    let buttonItem = detail.buttonItem || {}
    manager.start({
      lang: buttonItem.lang,
    })

    this.setData({
      recordStatus: 0,
      recording: true,
      currentTranslate: {
        // 当前语音输入内容
        create: util.recordTime(new Date()),
        text: '正在聆听中',
        lfrom: buttonItem.lang,
        lto: buttonItem.lto,
      },
    })
    this.scrollToNew();

  },


  /**
   * 松开按钮结束语音识别
   */
  streamRecordEnd: function(e) {

    // console.log("streamRecordEnd" ,e)
    let detail = e.detail || {}  // 自定义组件触发事件时提供的detail对象
    let buttonItem = detail.buttonItem || {}

    // 防止重复触发stop函数
    if(!this.data.recording || this.data.recordStatus != 0) {
      console.warn("has finished!")
      return
    }

    manager.stop()

    this.setData({
      bottomButtonDisabled: true,
    })
  },


  /**
   * 翻译
   */
  translateText: function(item, index) {
    let lfrom =  item.lfrom || 'zh_CN'
    let lto = item.lto || 'en_US'

    console.log(this.data.dialogList);
    console.log(`item: ${item}`);
    var that = this
    // 改成2 个接口，1.请求 ai，2.文字转语音
    // 请求 1
    // 发送POST请求
    const url = "https://spark-api-open.xf-yun.com/v1/chat/completions";
    var tips = " - 如果答案超过最大字数，请删除未完成的回答，否则会让用户感到不适"
wx.request({
  url: url, // 你的接口地址
  method: 'POST',
  data: {
    "max_tokens":80,

    "model": "generalv3.5", 
    "messages": [
        {
            "role": "user",
            "content": item.text
        }
    ],},
  header: {
    "Authorization": "Bearer htjXrgJvxdmIBBVCRWZB:WrTLiBTnyJUypIyTfnmL" // 注意此处替换自己的APIPassword
  },
  success(res) {
    console.log('请求成功', res)
    console.log(typeof res);
    var answer = res.data.choices[0].message.content
    console.log(answer);
    // 请求 2
//     answer = `
//     合肥今天天气状况为阴，温度范围在19℃~26℃，风向风力为东北风微风。建议市民根据天气变化适时调整着装，早晚可适当增添衣物以防凉。
// 具体天气情况如下：
// - 天气：阴。
// - 最高温度：26℃。
// - 最低温度：19℃。
// `
    plugin.textToSpeech({
      lang: "zh_CN",
      tts: true,
      content: answer,
      success: function(resTrans) {
          console.log("succ tts", resTrans.filename)   
          let passRetcode = [
            0, // 翻译合成成功
            -20001,//语音合成语言格式出错
            -20002,//	输入的待合成格式不正确
            -20003,//	语音合成内部错误
            -20005,//	网络错误
            -40001//	接口调用频率达到限制，请联系插件开发者
          ]
          if(passRetcode.indexOf(resTrans.retcode) >= 0 ) {
            let tmpDialogList = that.data.dialogList.slice(0)
            console.log(tmpDialogList);
            if(!isNaN(index)) {
  
              let tmpTranslate = Object.assign({}, item, {
                autoPlay: true, // 自动播放背景音乐
                translateText: resTrans.origin,
                translateVoicePath: resTrans.filename || "",
                translateVoiceExpiredTime: resTrans.expired_time || 0
              })
  
              tmpDialogList[index] = tmpTranslate
  
  
              that.setData({
                dialogList: tmpDialogList,
                bottomButtonDisabled: false,
                recording: false,
              })
  
              that.scrollToNew();
  
            } else {
              console.error("index error", resTrans, item)
            }
          } else {
            console.warn("回答失败", resTrans, item)
          }
      },
      fail: function(resTrans) {
        console.error("调用失败",resTrans, item)
        that.setData({
          bottomButtonDisabled: false,
          recording: false,
        })
      },
      complete: resTrans => {
        that.setData({
          recordStatus: 1,
        })
        wx.hideLoading()
      }
    })


  },
  fail(error) {
    console.error('请求失败', error)
  }
})



  },


  /**
   * 修改文本信息之后触发翻译操作
   */
  translateTextAction: function(e) {
    // console.log("translateTextAction" ,e)
    let detail = e.detail  // 自定义组件触发事件时提供的detail对象
    let item = detail.item
    let index = detail.index

    this.translateText(item, index)



  },

  /**
   * 语音文件过期，重新合成语音文件
   */
  expiredAction: function(e) {
    let detail = e.detail || {}  // 自定义组件触发事件时提供的detail对象
    let item = detail.item || {}
    let index = detail.index

    if(isNaN(index) || index < 0) {
      return
    }

    let lto = item.lto || 'en_US'
    console.log('语音文件过期，重新合成');
    plugin.textToSpeech({
      lang: lto,
      content: item.translateText,
      success: resTrans => {
        if(resTrans.retcode == 0) {
          let tmpDialogList = this.data.dialogList.slice(0)

          let tmpTranslate = Object.assign({}, item, {
            autoPlay: true, // 自动播放背景音乐
            translateVoicePath: resTrans.filename,
            translateVoiceExpiredTime: resTrans.expired_time || 0
          })

          tmpDialogList[index] = tmpTranslate


          this.setData({
            dialogList: tmpDialogList,
          })

        } else {
          console.warn("语音合成失败", resTrans, item)
        }
      },
      fail: function(resTrans) {
        console.warn("语音合成失败", resTrans, item)
      }
  })
  },

  /**
   * 初始化为空时的卡片
   */
  initCard: function () {
    let initTranslateNew = Object.assign({}, this.data.initTranslate, {
      create: util.recordTime(new Date()),
    })
    this.setData({
      initTranslate: initTranslateNew
    })
  },


  /**
   * 删除卡片
   */
  deleteItem: function(e) {
    // console.log("deleteItem" ,e)
    let detail = e.detail
    let item = detail.item

    let tmpDialogList = this.data.dialogList.slice(0)
    let arrIndex = detail.index
    tmpDialogList.splice(arrIndex, 1)

    // 不使用setTImeout可能会触发 Error: Expect END descriptor with depth 0 but get another
    setTimeout( ()=>{
      this.setData({
        dialogList: tmpDialogList
      })
      if(tmpDialogList.length == 0) {
        this.initCard()
      }
    }, 0)

  },


  /**
   * 识别内容为空时的反馈
   */
  showRecordEmptyTip: function() {
    this.setData({
      recording: false,
      bottomButtonDisabled: false,
    })
    wx.showToast({
      title: this.data.tips_language.recognize_nothing,
      icon: 'success',
      image: '/image/no_voice.png',
      duration: 1000,
      success: function (res) {

      },
      fail: function (res) {
        console.log(res);
      }
    });
  },


  /**
   * 初始化语音识别回调
   * 绑定语音播放开始事件
   */
  initRecord: function() {
    //有新的识别内容返回，则会调用此事件
    manager.onRecognize = (res) => {
      let currentData = Object.assign({}, this.data.currentTranslate, {
                        text: res.result,
                      })
      this.setData({
        currentTranslate: currentData,
      })
      this.scrollToNew();
    }

    // 识别结束事件
    manager.onStop = (res) => {

      let text = res.result

      if(text == '') {
        this.showRecordEmptyTip()
        return
      }

      let lastId = this.data.lastId + 1

      let currentData = Object.assign({}, this.data.currentTranslate, {
                        text: res.result,
                        translateText: '正在思考中',
                        id: lastId,
                        voicePath: res.tempFilePath
                      })

      this.setData({
        currentTranslate: currentData,
        recordStatus: 1,
        lastId: lastId,
      })

      this.scrollToNew();

      this.translateText(currentData, this.data.dialogList.length)
    }

    // 识别错误事件
    manager.onError = (res) => {

      this.setData({
        recording: false,
        bottomButtonDisabled: false,
      })

    }

    // 语音播放开始事件
    wx.onBackgroundAudioPlay(res=>{

      const backgroundAudioManager = wx.getBackgroundAudioManager()
      let src = backgroundAudioManager.src

      this.setData({
        currentTranslateVoice: src
      })

    })
  },

  /**
   * 设置语音识别历史记录
   */
  setHistory: function() {
    try {
      let dialogList = this.data.dialogList
      dialogList.forEach(item => {
        item.autoPlay = false
      })
      wx.setStorageSync('history',dialogList)

    } catch (e) {

      console.error("setStorageSync setHistory failed")
    }
  },

  /**
   * 得到历史记录
   */
  getHistory: function() {
    try {
      let history = wx.getStorageSync('history')
      if (history) {
          let len = history.length;
          let lastId = this.data.lastId
          if(len > 0) {
            lastId = history[len-1].id || -1;
          }
          this.setData({
            dialogList: history,
            toView: this.data.toView,
            lastId: lastId,
          })
      }

    } catch (e) {
      // Do something when catch error
      this.setData({
        dialogList: []
      })
    }
  },

  /**
   * 重新滚动到底部
   */
  scrollToNew: function() {
    this.setData({
      toView: this.data.toView
    })
  },

  onShow: function() {
    this.scrollToNew();

    this.initCard()

    if(this.data.recordStatus == 2) {
      wx.showLoading({
        // title: '',
        mask: true,
      })
    }

  },

  onLoad: function () {

    

    this.getHistory()
    this.initRecord()


    this.setData({toView: this.data.toView})


    app.getRecordAuth()

  },

  onHide: function() {
    this.setHistory()
  },
})
