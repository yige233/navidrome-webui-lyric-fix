# 对原js进行了修改的部分

## 1. 修改随机播放时的最大歌曲数量

将`perPage`改为99999。

```javascript
/** Patch: 修改随机播放时的最大歌曲数量 */
r.getList("song", { pagination: { page: 1, perPage: 99999 }, sort: { field: "random", order: "ASC" }, filter: e })
```

## 2. 禁用原始的歌词切换功能

修改了`onLyricChange`监听器，通过在函数开头添加一个`return`语句，使其失效。

```javascript
bt(wt(a), "onLyricChange", function (i) {
  /** Patch: 禁用原始的歌词切换功能 */
  return;
  var o = i.lineNum,
    s = i.txt;
  (a.setState({ currentLyric: s }), a.props.onAudioLyricChange && a.props.onAudioLyricChange(o, s));
}),
```

## 3. 同步更新 pipLyric

修改了`updateMediaSessionMetadata`监听器，在函数末尾调用我们的`pipLyric.songChange`函数。

```javascript
bt(wt(a), "updateMediaSessionMetadata", function () {
  if ("mediaSession" in navigator && a.props.showMediaSession) {
    var i = a.state,
      o = i.name,
      s = i.cover,
      u = i.singer,
      l = { title: o, artist: u, album: o };
    (s &&
      (l.artwork = ["96x96", "128x128", "192x192", "256x256", "384x384", "512x512"].map(function (c) {
return { src: s, sizes: c, type: "image/png" };
      })),
      (navigator.mediaSession.metadata = new MediaMetadata(l)),
      a.updateMediaSessionPositionState());
    /** Patch: 同步更新 pipLyric */
    pipLyric.songChange(i);
  }
}),
```

### 4. 更新我们自己的歌词到UI

在合适的位置监听`pipLyric`的`lyric`事件，并调用`setState`更新UI。

```javascript
/** Patch: 监听歌词更新，然后更新ui上显示的歌词 */
pipLyric.addEventListener("lyric", ({ detail }) => a.setState({ currentLyric: detail })),
```

### 5. 核心功能

在原js文件末尾添加全部的`patch.js`中的代码。
