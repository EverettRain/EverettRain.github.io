var posts=["2024/12/09/hello-world/","2024/12/16/prologue/","2024/12/11/搭建Hexo博客网站教程/","2024/12/11/更高级的Markdown渲染器/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };