import "reflect-metadata"
import { createConnection, getManager } from 'typeorm'
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
  title_cn?: string // 中文的标题
  category: number // 内容分类，对应：Post, Jobs, 📘 Articles & Tutorials, 🔧 Code & Tools, Quick bytes, ⚡️ Quick Releases
  link?: string // 内容外链
  pic?: string // 可能的配图
  summary?: string // 简介
  summary_cn?: string // 中文简介
}

let category = 0 // 类型id
let theNext = 456
let Posts: IPost[] = []

// const URI = 'https://javascriptweekly.com/issues/latest';
const URI = 'https://javascriptweekly.com/issues/'

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
async function saveData () {
  const ArticleRepository = getManager().getRepository(JavaScriptWeekly)
  Posts.forEach(v => {
    const article = new JavaScriptWeekly()
    article.pid = v.pid
    article.page = v.page
    article.date = v.date
    article.category = v.category
    article.title = v.title || ''
    article.title_cn = v.title_cn || ''
    article.link = v.link || ''
    article.pic = v.pic || ''
    article.summary = v.summary || ''
    article.summary_cn = v.summary_cn || ''
    ArticleRepository.save(article)
  })
  // setTimeout(() => {
  //   console.log(theNext, 'done')
  //   theNext += 1
  //   // crawJob()
  // }, 2000)
}

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
  const date = title.split(': ')[1]
  const main = $('#content')
  const tables = main.children('table')
  category = 0
  Posts = []
  for (const table of Array.from(tables)) {
    const cs = table.attribs.class ? table.attribs.class.trim() : ''
    const $$ = cheerio.load(table)
    if (cs === 'el-heading') category += 1
    if (cs === 'el-fullwidthimage') {
      // 封面图
      const link = $$('a').attr('href')
      const img = $$('img').attr('src')
      console.log(link, img)
    }
    if (cs === 'el-subtable') {
      // Quick bytes OR Quick Releases
      const subTable = $$('.content.el-content')
      const subUl = $$('.nogap li')
      for (const li of Array.from(subUl)) {
        const $$$ = cheerio.load(li)
        const title = $$$('')
        if (subTable.attr('class') === 'content el-content briefs') {
          // Quick bytes
          const title = $$$('li').text()
          const link = $$$('a').attr('href')
          const title_cn = await google.translate(title)
          const post = {
            pid: link.replace(/[^0-9]/ig, ''),
            page: String(theNext),
            date,
            title,
            category: 6,
            title_cn: title_cn.result.toString()
          }
          Posts.push(post)
        } else {
          // Quick Releases
          const title = $$$('a').text()
          const summary = $$$('li').text()
          const link = $$$('a').attr('href')
          const summary_cn = await google.translate(summary)
          const post = {
            pid: link.replace(/[^0-9]/ig, ''),
            page: String(theNext),
            date,
            title,
            category: 7,
            summary,
            summary_cn: summary_cn.result.toString()
          }
          Posts.push(post)
        }
      }
    }
    if (cs === 'el-item item') {
      const title = $$('.mainlink a').text()
      const link = $$('.mainlink a').attr('href')
      const summary = $$('.desc').text()
      const pic = $$('.som').attr('src') || ''
      if (title && link && summary) {
        const summary_cn = await google.translate(summary)
        const post = {
          pid: link.replace(/[^0-9]/ig, ''),
          page: String(theNext),
          date,
          title,
          category,
          pic,
          summary,
          summary_cn: summary_cn.result.toString()
        }
        Posts.push(post)
      }
    }
  }
  await saveData()
  await browser.close()
}

crawJob()