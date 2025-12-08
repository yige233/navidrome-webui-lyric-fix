# navidrome webui 歌词显示优化

navidrome webui 使用的是 navidrome API，而该 API 并不支持外部 lrc 歌词文件，并且由于当前 webui 使用的播放器的限制，后续也不会“修复”该“bug”：https://github.com/navidrome/navidrome/issues/4148#issuecomment-2936319726

然而 navidrome 的 subsonic API 可以获取到外部 lrc 歌词，所以我们可以另外通过该 API 获取到歌词后，传递给播放器。只需要修改前端 js 代码就能做到。

修改后的代码修复/增加/优化了如下功能：

- 歌曲页的“随机播放全部”功能，可以获取到大于 500 首歌曲。
- webui 自带的歌词会显示前一首歌的歌词。该 bug 似乎已由 https://github.com/navidrome/react-music-player/pull/1 修复，但实际上并未生效。
- webui 自带的歌词可以显示为双行（通过 css:`white-space: break-spaces;`），可以实现显示歌词翻译的效果。
- 右键“切换歌词”按钮，可以呼出一个始终置顶的小窗口，实现类似桌面歌词的效果。需要浏览器支持`documentPictureInPicture`API。
  - 默认状态下会显示双行歌词(不是指翻译，而是会显示当前歌词和下一句歌词)。可按`M`键在单行和双行显示中切换。
  - 默认状态下，会尝试解析并显示歌词注音。可按`P`键切换注音的显示状态。[关于注音格式](#关于注音格式)
  - 按下`Ctrl+R`可以重载歌词。重载期间歌曲进度条会变成黄色。
  - ~~右键该窗口，可以将其缩放至尽可能小的状态。~~ 现在仅可在单行歌词模式下横向缩放。
  - 聚焦窗口时按下`I`键，可以显示当前歌曲的部分信息。
  - 按下`←`和`→`键，可以减小/增加歌词的`offset`值，粒度为`100ms`，若同时按住`Ctrl`可增大至`500ms`。按下`R`键可将其设为`0`。
  - 按下`T`键可切换翻译歌词的显示状态。

## 关于注音格式

前导字符为空格，或者位于歌词开头，并尾随有一对英文半角括号，且括号内包含有字符的，可以被解析为注音。例如：

```lrc
[00:49.209]遙(はる)かなる 空(そら)は
```

忽略掉时间标签，`遙(はる)`和`空(そら)`符合上述条件，因此注音后的歌词为：

> **<ruby>遙<rp>(</rp><rt>はる</rt><rp>)</rp></ruby>かなる<ruby>空<rp>(</rp><rt>そら</rt><rp>)</rp></ruby>は**

> [!WARNING]
> 反斜杠`\`和嵌套的括号`()`可能会影响到对注音的解析。

## 使用修改后的 js 文件替代原有的 js 文件

_示例适用于：navidrome v0.59.0_

1. 在 webui 中打开浏览器的 devtool，然后执行下列代码：

```javascript
(async function () {
  /** navidrome v0.59.0 */
  const jsURL = `https://cdn.jsdelivr.net/gh/yige233/navidrome-webui-lyric-fix@main/v0.58.5/index-ASG3RMXC.js`;
  const appJsURL = `/app/assets/index-ASG3RMXC.js`;

  const [, cacheKey] = await caches.keys();
  const cache = await caches.open(cacheKey);

  const resp = await fetch(jsURL);
  if (!resp.ok) {
    throw new TypeError("无法获取js资源");
  }
  await cache.put(appJsURL, new Response(resp.body, { headers: resp.headers }));
  location.reload();
})();
```

2. 或者在反代软件内重定向 js URL，以 Apache 为例：

```apache
<VirtualHost *:443>
    ServerName music.example.com
    ProxyVia On
    #这里是将js文件放到apache自带的静态目录中，提高反代访问速度。
    ProxyPass "/app/assets/index-ASG3RMXC.js"  "http://localhost/index-ASG3RMXC.js"
    ProxyPassReverse "/app/assets/index-ASG3RMXC.js"  "http://localhost/index-ASG3RMXC.js"
    #这里反代navidrome
    ProxyPass "/"  "http://127.0.0.1:4500/"
    ProxyPassReverse "/"  "http://127.0.0.1:4500/"
    Include "${SRVROOT}/example.comp/ssl.conf"
</VirtualHost>
```

方案 1 需要一个能访问得通 jsdelivr CDN 的网络。

方案 2 并不能立即生效，原因是 webui 加载时会缓存 js 文件，每次打开网页时优先使用缓存。需要删除网站数据，使其重新从服务端拉取 js 文件。
