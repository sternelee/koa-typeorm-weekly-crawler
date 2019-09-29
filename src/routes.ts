import PostController from './controller/post-controller'

export default [
  {
    path: '/',
    method: 'get',
    action: PostController.index
  },
  {
    path: '/all',
    method: 'get',
    action: PostController.findPost
  }
];
