import "reflect-metadata"
import { createConnection, getManager } from 'typeorm'
import * as Crawler from 'crawler'
import * as puppeteer from 'puppeteer'
import co from 'co'
import * as cheerio from 'cheerio'
import { youdao, baidu, google } from 'translation.js'
import { JavaScriptWeekly } from './src/entity/JavaScriptWeekly'

const myConnection = createConnection()

interface IPost {
  pid: string //内容ID
  page: string // 期号，当作页码
  date: string // 期号对应的日期
  title: string // 内容标题
  category: number // 内容分类，对应：Post, Quick bytes, Jobs, 📘 Articles & Tutorials, 🔧 Code & Tools, ⚡️ Quick Releases
  link: string // 内容外链
  summary: string // 简介
  summary_cn?: string // 中文简介
}

let category = 0 // 类型id
let theNext = 456
let Posts: IPost[] = []

// const URI = 'https://javascriptweekly.com/issues/latest';
const URI = 'https://javascriptweekly.com/issues/'

// 使用 crawler
let c = new Crawler({
    retries:1,
    retryTimeout:3000
})

let errorCount = 0

const getHtml = co.wrap(function*(html){
    return new Promise((resolve, reject)=>{
        setTimeout(()=>{
            c.queue({
                url: html,
                forceUTF8: true,
                callback: function (error, result, $) {
                    if(error || !result.body){
                        errorCount++;
                        return resolve({result:false});
                    }
                    result = result.body;
                    resolve({error, result, $})
                }
            })
        }, 2000)
    })

})

const getSubHtml = co.wrap(function*(body){
    let $ = cheerio.load(body)
    let tables = $('#content').children('table')
    // tables = Array.from(tables)
    const date = $('title').text().split(': ')[1]
    Posts = []
    category = 0
    tables.forEach(v => {
      const cs = v.attribs.class ? v.attribs.class.trim() : ''
      if (cs === 'el-heading') key += 1
      if (cs === 'el-item item') {
        const $$ = cheerio.load(v.children)
        const title = $$('.mainlink a').text()
        const link = $$('.mainlink a').attr('href')
        const summary = $$('.desc').text()
        // console.log(title, link, summary)
        if (title && link && summary) {
          const post = {
            pid: link.replace(/[^0-9]/ig, ''),
            page: String(theNext),
            date,
            title,
            category: key === 0 ? 'new' : (key === 1 ? 'post' : 'tool'),
            link,
            summary
          }
          Posts.push(post)
        }
      }
    })
});


// 翻译简介内容
function translateAll () {
  const maxLen = Posts.length
  let idx = 0
  Posts.forEach((v, index) => {
    google.translate(v.summary).then(res => {
      idx += 1
      Posts[index].summary_cn = res.result.toString()
      if (idx >= maxLen) {
        saveData()
      }
    })
  })
}

// 保存数据到 sqlit3
function saveData () {
  const ArticleRepository = getManager().getRepository(JavaScriptWeekly)
  Posts.forEach(v => {
    const article = new JavaScriptWeekly()
    article.pid = v.pid
    article.page = v.page
    article.date = v.date
    article.category = v.category
    article.title = v.title
    article.link = v.link
    article.summary = v.summary
    article.summary_cn = v.summary_cn
    ArticleRepository.save(article)
  })
  setTimeout(() => {
    console.log(theNext, 'done')
    theNext += 1
    runApp()
  }, 2000)
  // createConnection().then(async connection => {
  //   const ArticleRepository = getManager().getRepository(Weekly)
  //   Posts.forEach(v => {
  //     const article = new Weekly()
  //     article.pid = v.pid
  //     article.page = v.page
  //     article.date = v.date
  //     article.category = v.category
  //     article.title = v.title
  //     article.link = v.link
  //     article.summary = v.summary
  //     article.summary_cn = v.summary_cn
  //     ArticleRepository.save(article)
  //   })
  //   setTimeout(() => {
  //     console.log(theNext + 1, 'done')
  //     if (theNext > 400) {
  //       runApp()
  //     }
  //   }, 2000)
  // }).catch(error => console.log("TypeORM connection error: ", error));
}

// co(function*(){
//   let { result } = yield getHtml(URI + key);
//   yield getSubHtml(result);
//   translateAll()
// })

const runApp = co.wrap(function* () {
  let { result } = yield getHtml(URI + theNext);
  yield getSubHtml(result);
  translateAll()
})

// runApp()

// 使用 puppeteer
const crawJob = async function () {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox'],
    dumpio: false
  })
  const page = await browser.newPage()
  // 模拟iphone X设备
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1')
  await page.setViewport({
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  })
  await page.goto(URI + theNext, {
    waitUntil: 'networkidle2',
    timeout: 30000
  })
  const content = await page.content()
  // const body = await page.$('body')
  // console.log(content)
  const $ = await cheerio.load(content)
  // console.log($('.mainlink'))
  const title = $('title').text()
  console.log(title)
  const date = title.split(': ')[1]
  const main = $('#content')
  const tables = main.children('table')
  console.log(date)
  category = 0
  Posts = []
  for (const table of Array.from(tables)) {
    // console.log(table.attribs.class)
    const cs = table.attribs.class ? table.attribs.class.trim() : ''
    const $$ = cheerio.load(table.children.toString())
    if (cs === 'el-heading') category += 1
    if (cs === 'el-subtable ') {
      // Quick bytes OR Quick Releases
      const tableCli = $$('table')[0]
      if (tableCli.attribs.class === 'content el-content briefs') {
        // Quick bytes
        const $$$ = cheerio.load(tableCli.children.toString())
        const list = $$$('li')
        for (let i = 0; i < list.length; i++) {
          console.log(list[i])
        }
      } else {
        // Quick Releases
      }
    }
    if (cs === 'el-fullwidthimage') {
      // 封面图
      const link = $$('a').attr('href')
      const img = $$('img').attr('src')
      console.log(link, img)
    }
    if (cs === 'el-item item') {
      const title = $$('.mainlink a').text()
      const link = $$('.mainlink a').attr('href')
      const summary = $$('.desc').text()
      if (title && link && summary) {
        const summary_cn = await google.translate(summary)
        const post = {
          pid: link.replace(/[^0-9]/ig, ''),
          page: String(theNext),
          date,
          title,
          category,
          link,
          summary,
          summary_cn: summary_cn.result.toString()
        }
        Posts.push(post)
      }
    }
  }
  console.log(Posts)
  // tables.forEach(v => {
  //   const cs = v.attribs.class ? v.attribs.class.trim() : ''
  //     if (cs === 'el-heading') key += 1
  //     if (cs === 'el-item item') {
  //       const $$ = cheerio.load(v.children)
  //       const title = $$('.mainlink a').text()
  //       const link = $$('.mainlink a').attr('href')
  //       const summary = $$('.desc').text()
  //       // console.log(title, link, summary)
  //       if (title && link && summary) {
  //         const post = {
  //           pid: link.replace(/[^0-9]/ig, ''),
  //           page: String(theNext),
  //           date,
  //           title,
  //           category: key === 0 ? 'new' : (key === 1 ? 'post' : 'tool'),
  //           link,
  //           summary
  //         }
  //         Posts.push(post)
  //       }
  //     }
  // })
  // console.log(Posts)
  // console.log('body', body)
  // const tables = await page.$$('table')
  // console.log(tables)
  // const result = await page.evaluate(() => {
  //   const tables = document.querySelectorAll('table')
  //   console.log(tables)
  //   return {
  //     tables: []
  //   }
  // })
  await browser.close()
}

crawJob()