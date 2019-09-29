import "reflect-metadata"
import * as Koa from 'koa'
import * as Router from 'koa-router'
import * as bodyParser from 'koa-bodyparser'
import * as logger from 'koa-logger'
import * as json from 'koa-json'
import * as path from 'path'
import * as koaStatic from 'koa-static'
import { createConnection } from 'typeorm'
import AppRoutes from './routes'

// 使用 typeorm 连接数据库
createConnection().then(async connection => {

  const app = new Koa();
  const router = new Router();
  const port = process.env.PORT || 3200;

  //路由
  AppRoutes.forEach(route => router[route.method](route.path, route.action));

  // 静态资源目录对于相对入口文件app.js的路径
  const staticPath = './static'
  app.use(koaStatic(
    path.join( __dirname,  staticPath)
  ))

  // 中间件
  app.use(json())
  app.use(logger())
  app.use(bodyParser());
  app.use(router.routes());
  app.use(router.allowedMethods());
  app.listen(port);

  console.log(`应用启动成功 端口:${port}`);

}).catch(error => console.log("TypeORM connection error: ", error));

