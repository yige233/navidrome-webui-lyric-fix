# 对原js进行了修改的部分

## 1. 修改随机播放时的最大歌曲数量

将`perPage`改为99999。

```javascript
/** Patch: 修改随机播放时的最大歌曲数量 */
n.getList("song", { pagination: { page: 1, perPage: 99999 }, sort: { field: "random", order: "ASC" }, filter: e })
```

## 2. 禁用原始的歌词切换功能

修改了`onLyricChange`监听器，通过在函数开头添加一个`return`语句，使其失效。

```javascript
_t(r, "onLyricChange", function (a) {
  /** Patch: 禁用原始的歌词切换功能 */
  return;
  var i = a.lineNum,
    o = a.txt;
  (r.setState({ currentLyric: o }), r.props.onAudioLyricChange && r.props.onAudioLyricChange(i, o));
}),

```

## 3. 同步更新 pipLyric

修改了`updateMediaSessionMetadata`监听器，在函数末尾调用我们的`pipLyric.songChange`函数。

```javascript
_t(r, "updateMediaSessionMetadata", function () {
  if ("mediaSession" in navigator && r.props.showMediaSession) {
    var a = r.state,
      i = a.name,
      o = a.cover,
      s = a.singer,
      u = { title: i, artist: s, album: i };
    (o &&
      (u.artwork = ["96x96", "128x128", "192x192", "256x256", "384x384", "512x512"].map(function (l) {
        return { src: o, sizes: l, type: "image/png" };
      })),
      (navigator.mediaSession.metadata = new MediaMetadata(u)),
      r.updateMediaSessionPositionState());
    /**
     * Patch: 同步更新 pipLyric。v0.61.0版本出现了一个bug，导致updateMediaSessionMetadata被调用时，
     * 应该同步给mediaSession的元数据有可能还是空的，我们在这里用interval等待它更新了，再传递给pipLyric.songChange
     */
    let interval = setInterval(() => {
      if (!r.state.cover) return;
      pipLyric.songChange(r.state);
      clearInterval(interval);
    }, 1);
  }
}),

```

### 4. 更新我们自己的歌词到UI

在合适的位置监听`pipLyric`的`lyric`事件，并调用`setState`更新UI。

```javascript
/** Patch: 监听歌词更新，然后更新ui上显示的歌词 */
pipLyric.addEventListener("lyric", ({ detail }) => r.setState({ currentLyric: detail })),
```

### 5. 核心功能

在原js文件末尾添加全部的`patch.js`中的代码。
