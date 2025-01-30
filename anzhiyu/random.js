var posts=["2024/12/26/C01P01/","2025/01/04/C01P02/","2025/01/18/Chapter5/","2024/12/20/CylinderCaster/","2024/12/28/IntroductionReview/","2024/12/09/hello-world/","2024/12/19/WheelCollider2/","2024/12/16/prologue/","2024/12/11/搭建Hexo博客网站教程/","2024/12/11/更高级的Markdown渲染器/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };