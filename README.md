# navidrome webui 歌词显示优化
navidrome webui 使用的是navidrome API，而该API并不支持外部lrc歌词文件，并且由于当前webui使用的播放器的限制，后续也不会“修复”该“bug”：https://github.com/navidrome/navidrome/issues/4148#issuecomment-2936319726

然而navidrome的 subsonic API 可以获取到外部lrc歌词，所以我们可以另外通过该API获取到歌词后，传递给播放器。只需要修改前端js代码就能做到。

修改后的代码修复/增加/优化了如下功能：
- 歌曲页的“随机播放全部”功能，可以获取到大于500首歌曲。
- webui自带的歌词会显示前一首歌的歌词。该bug似乎已由 https://github.com/navidrome/react-music-player/pull/1 修复，但实际上并未生效。
- webui自带的歌词可以显示为双行（通过css:`white-space: break-spaces;`），可以实现显示歌词翻译的效果。
- 右键“切换歌词”按钮，可以呼出一个始终置顶的小窗口，实现类似桌面歌词的效果。需要浏览器支持`documentPictureInPicture`API。
  - 右键该窗口，可以将其缩放至尽可能小的状态。
  - 聚焦窗口时按下i键，可以显示当前歌曲的部分信息。
  - 按下←和→键，可以减小/增加歌词的offset值，step为100ms，若同时按住ctrl可增大至500ms。按下r键可将其设为0。
  - 按下t键可切换翻译歌词的显示状态。
 
## 使用修改后的js文件替代原有的js文件

1. 在webui中打开浏览器的devtool，然后执行下列代码：
```javascript
(async function () {
  /** navidrome v0.58 */
  const jsURL = `https://cdn.jsdelivr.net/gh/yige233/navidrome-webui-lyric-fix@main/v0.58.0/index-BvBAiUnp.js`;
  const appJsURL = `/app/assets/index-BvBAiUnp.js`;

  const [, cacheKey] = await caches.keys();
  const cache = await caches.open(cacheKey);

  const resp = await fetch(jsURL);
  if (!resp.ok) {
    throw new TypeError("无法获取js资源");
  }
  await cache.put(appJsURL, resp);
  location.reload();
})();
```
2. 或者在反代软件内重定向js URL，以Apache为例：
```apache
<VirtualHost *:443>
    ServerName music.example.com
    ProxyVia On
    #这里是将js文件放到apache自带的静态目录中，提高反代访问速度。
    ProxyPass "/app/assets/index-BvBAiUnp.js"  "http://localhost/index-BvBAiUnp.js"
    ProxyPassReverse "/app/assets/index-BvBAiUnp.js"  "http://localhost/index-BvBAiUnp.js"
    #这里反代navidrome
    ProxyPass "/"  "http://127.0.0.1:4500/"
    ProxyPassReverse "/"  "http://127.0.0.1:4500/"
    Include "${SRVROOT}/example.comp/ssl.conf"
</VirtualHost>
```

方案1需要一个能访问得通jsdelivr CDN的网络。

方案2并不能立即生效，原因是webui加载时会缓存js文件，每次打开网页时优先使用缓存。需要删除网站数据，使其重新从服务端拉取js文件。
