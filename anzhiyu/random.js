var posts=["2024/12/26/C01P01/","2025/01/04/C01P02/","2025/01/31/C01P03/","2025/02/01/C01P04/","2025/02/03/C01P05/","2025/01/18/Chapter5/","2024/12/20/CylinderCaster/","2025/02/03/Enamoramiento/","2024/12/28/IntroductionReview/","2025/02/15/MacBookPro/","2025/02/27/NodeJS-MySQL/","2025/02/13/RemoteDesktop/","2025/02/15/StudyMySQL/","2025/04/13/csharp-events/","2024/12/09/hello-world/","2025/02/08/javaManager/","2024/12/19/WheelCollider2/","2025/04/10/anzhiyu-theme-tag/","2024/12/16/prologue/","2024/12/11/搭建Hexo博客网站教程/","2024/12/11/更高级的Markdown渲染器/"];function toRandomPost(){
    pjax.loadUrl('/'+posts[Math.floor(Math.random() * posts.length)]);
  };