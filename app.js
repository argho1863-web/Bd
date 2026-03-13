  /* ── CONFIG ─────────────────────────────────────────────── */
  var CLOUD   = 'dxi1ky1ua';
  var API_KEY = '199263962135337';
  var SECRET  = 'pSAjcok5y0EFH4fKkaNcnNHhVXA';
  var FOLDER  = 'Birthday';
  var PASS    = 'birthday2024';

  /* ── STATE ──────────────────────────────────────────────── */
  var allVideos   = [];
  var currentVideo = null;
  var deleteConfirmId = null;

  /* ══════════════════════════════════════════════════════════
     AUTH
     ══════════════════════════════════════════════════════════ */
  function login() {
    var pw = document.getElementById('pw-input').value;
    if (pw === PASS) {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      sessionStorage.setItem('vault_auth', '1');
      loadVideos();
    } else {
      var box = document.getElementById('login-box');
      var err = document.getElementById('login-error');
      box.classList.add('shake');
      err.classList.add('show');
      setTimeout(function() { box.classList.remove('shake'); }, 400);
      setTimeout(function() { err.classList.remove('show'); }, 2500);
      document.getElementById('pw-input').value = '';
    }
  }

  function logout() {
    sessionStorage.removeItem('vault_auth');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
    document.getElementById('pw-input').value = '';
  }

  function togglePw() {
    var inp = document.getElementById('pw-input');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  }

  document.getElementById('pw-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') login();
  });

  if (sessionStorage.getItem('vault_auth') === '1') {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    loadVideos();
  }

  /* ══════════════════════════════════════════════════════════
     CLOUDINARY — LIST VIDEOS
     ══════════════════════════════════════════════════════════ */
  function loadVideos() {
    showSkeletons();

    /*
      Cloudinary Search API — the correct endpoint for browser use.
      The Admin /resources/video endpoint blocks all browser requests.
      The Search API supports CORS from any HTTPS origin.
    */
    var url = 'https://api.cloudinary.com/v1_1/' + CLOUD + '/resources/search';
    var body = JSON.stringify({
      expression: 'folder=' + FOLDER + ' AND resource_type=video',
      sort_by: [{ created_at: 'desc' }],
      max_results: 100,
      with_field: ['tags', 'context']
    });

    var xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Basic ' + btoa(API_KEY + ':' + SECRET));
    xhr.timeout = 20000;

    xhr.onload = function() {
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.error) {
          showToast('error', 'API error: ' + data.error.message);
          renderGrid([]); return;
        }
        allVideos = (data.resources || []).sort(function(a, b) {
          return new Date(b.created_at) - new Date(a.created_at);
        });
        updateStats();
        renderGrid(allVideos);
        document.getElementById('stat-time').textContent = new Date().toLocaleTimeString();
        showToast('success', 'Loaded ' + allVideos.length + ' video' + (allVideos.length !== 1 ? 's' : '') + '.');
      } catch(e) {
        showToast('error', 'Could not parse response.');
        renderGrid([]);
      }
    };

    xhr.onerror = function() {
      showToast('error', 'Network error. Check internet connection.');
      renderGrid([]);
    };

    xhr.ontimeout = function() {
      showToast('error', 'Request timed out. Try again.');
      renderGrid([]);
    };

    xhr.send(body);
  }

  /* ══════════════════════════════════════════════════════════
     CLOUDINARY — DELETE VIDEO (SHA-1 signed)
     ══════════════════════════════════════════════════════════ */
  async function deleteVideo(publicId) {
    var ts  = Math.floor(Date.now() / 1000).toString();
    var str = 'public_id=' + publicId + '&timestamp=' + ts + SECRET;

    /* SHA-1 via Web Crypto API */
    var msgBuf  = new TextEncoder().encode(str);
    var hashBuf = await crypto.subtle.digest('SHA-1', msgBuf);
    var hashArr = Array.from(new Uint8Array(hashBuf));
    var sig     = hashArr.map(function(b){ return b.toString(16).padStart(2,'0'); }).join('');

    return new Promise(function(resolve, reject) {
      var fd = new FormData();
      fd.append('public_id', publicId);
      fd.append('api_key',   API_KEY);
      fd.append('timestamp', ts);
      fd.append('signature', sig);

      var xhr = new XMLHttpRequest();
      xhr.open('POST', 'https://api.cloudinary.com/v1_1/' + CLOUD + '/video/destroy', true);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.onload = function() {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch(e) { reject(new Error('Bad response')); }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send(fd);
    });
  }

  /* ══════════════════════════════════════════════════════════
     RENDER GRID
     ══════════════════════════════════════════════════════════ */
  function showSkeletons() {
    var g = document.getElementById('video-grid');
    g.className = 'loading-grid';
    var html = '';
    for (var i = 0; i < 6; i++) {
      html += '<div class="skeleton">'
            +   '<div class="skeleton-thumb"></div>'
            +   '<div class="skeleton-info">'
            +     '<div class="skeleton-line"></div>'
            +     '<div class="skeleton-line short"></div>'
            +     '<div class="skeleton-line xshort"></div>'
            +   '</div>'
            + '</div>';
    }
    g.innerHTML = html;
  }

  function renderGrid(videos) {
    var g = document.getElementById('video-grid');
    g.className = 'grid';

    if (videos.length === 0) {
      g.innerHTML = '<div class="empty-state">'
                  +   '<div class="empty-icon">🎞</div>'
                  +   '<div class="empty-title">No recordings yet</div>'
                  +   '<div class="empty-sub">Videos will appear here once they\'re uploaded</div>'
                  + '</div>';
      return;
    }

    g.innerHTML = videos.map(function(v) {
      var pid      = v.public_id;
      var name     = pid.split('/').pop().replace(/-/g, ' ').replace(/_/g, ' ');
      var date     = new Date(v.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
      var time     = new Date(v.created_at).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
      var size     = (v.bytes / (1024*1024)).toFixed(1);
      var duration = v.duration ? formatDuration(v.duration) : '--:--';
      var thumbUrl = 'https://res.cloudinary.com/' + CLOUD + '/video/upload/w_600,f_jpg/' + pid + '.jpg';
      var videoUrl = 'https://res.cloudinary.com/' + CLOUD + '/video/upload/' + pid + '.mp4';
      var escapedPid = pid.replace(/'/g, "\\'");
      var escapedUrl = videoUrl.replace(/'/g, "\\'");
      var escapedName = name.replace(/'/g, "\\'");
      var escapedMeta = (date + ' · ' + time + ' · ' + size + ' MB').replace(/'/g, "\\'");

      return '<div class="card" onclick="openModal(\'' + escapedPid + '\',\'' + escapedUrl + '\',\'' + escapedName + '\',\'' + escapedMeta + '\')">'
           +   '<div class="card-thumb">'
           +     '<video src="' + videoUrl + '#t=0.5" preload="metadata" muted></video>'
           +     '<div class="card-play"><div class="play-circle"><span class="play-icon">▶</span></div></div>'
           +     '<div class="card-duration">' + duration + '</div>'
           +   '</div>'
           +   '<div class="card-info">'
           +     '<div class="card-name">' + name + '</div>'
           +     '<div class="card-meta">'
           +       '<span class="meta-tag">Date <b>' + date + '</b></span>'
           +       '<span class="meta-tag">Time <b>' + time + '</b></span>'
           +       '<span class="meta-tag">Size <b>' + size + ' MB</b></span>'
           +     '</div>'
           +     '<div class="card-actions">'
           +       '<button class="action-btn" onclick="event.stopPropagation();downloadVideo(\'' + escapedUrl + '\',\'' + escapedName + '\')">⬇ Download</button>'
           +       '<button class="action-btn delete" id="del-' + pid.replace(/\//g,'_') + '" onclick="event.stopPropagation();confirmDelete(\'' + escapedPid + '\')">🗑 Delete</button>'
           +     '</div>'
           +   '</div>'
           + '</div>';
    }).join('');
  }

  /* ══════════════════════════════════════════════════════════
     DELETE FLOW (two-tap confirm)
     ══════════════════════════════════════════════════════════ */
  function confirmDelete(publicId) {
    /* First tap — turn red and ask to confirm */
    var safeId = publicId.replace(/\//g,'_');
    var btn = document.getElementById('del-' + safeId);
    if (!btn) return;

    if (deleteConfirmId === publicId) {
      /* Second tap — actually delete */
      deleteConfirmId = null;
      btn.disabled = true;
      btn.textContent = '⏳ Deleting…';
      deleteVideo(publicId)
        .then(function(res) {
          if (res.result === 'ok') {
            allVideos = allVideos.filter(function(v){ return v.public_id !== publicId; });
            updateStats();
            renderGrid(allVideos);
            showToast('success', 'Video deleted successfully.');
            if (currentVideo && currentVideo.publicId === publicId) closeModal();
          } else {
            showToast('error', 'Delete failed: ' + (res.error ? res.error.message : 'Unknown error'));
          }
        })
        .catch(function() { showToast('error', 'Delete failed. Please try again.'); });
    } else {
      /* Reset previous confirm if any */
      if (deleteConfirmId) {
        var prev = document.getElementById('del-' + deleteConfirmId.replace(/\//g,'_'));
        if (prev) { prev.classList.remove('confirm-del'); prev.textContent = '🗑 Delete'; }
      }
      deleteConfirmId = publicId;
      btn.classList.add('confirm-del');
      btn.textContent = '⚠ Confirm';
      setTimeout(function() {
        if (deleteConfirmId === publicId) {
          deleteConfirmId = null;
          if (btn) { btn.classList.remove('confirm-del'); btn.textContent = '🗑 Delete'; }
        }
      }, 3000);
    }
  }

  /* ══════════════════════════════════════════════════════════
     DOWNLOAD
     ══════════════════════════════════════════════════════════ */
  function downloadVideo(url, name) {
    showToast('info', 'Starting download…');
    fetch(url)
      .then(function(r){ return r.blob(); })
      .then(function(blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name + '.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
        showToast('success', 'Download started!');
      })
      .catch(function() {
        /* fallback — open in new tab */
        window.open(url, '_blank');
        showToast('info', 'Opened in new tab.');
      });
  }

  /* ══════════════════════════════════════════════════════════
     MODAL
     ══════════════════════════════════════════════════════════ */
  function openModal(publicId, videoUrl, name, meta) {
    currentVideo = { publicId: publicId, videoUrl: videoUrl, name: name, meta: meta };
    document.getElementById('modal-video').src = videoUrl;
    document.getElementById('modal-name').textContent = name;
    document.getElementById('modal-meta').textContent = meta;
    var delBtn = document.getElementById('modal-del-btn');
    delBtn.classList.remove('confirm-del');
    delBtn.textContent = '🗑 Delete';
    document.getElementById('modal-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var vid = document.getElementById('modal-video');
    vid.pause();
    vid.src = '';
    document.getElementById('modal-overlay').classList.remove('open');
    document.body.style.overflow = '';
    currentVideo = null;
    deleteConfirmId = null;
  }

  function closeModalOutside(e) {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  }

  function downloadCurrent() {
    if (currentVideo) downloadVideo(currentVideo.videoUrl, currentVideo.name);
  }

  function deleteCurrent() {
    if (!currentVideo) return;
    var btn = document.getElementById('modal-del-btn');
    if (btn.textContent.includes('Confirm')) {
      /* Actually delete */
      btn.disabled = true; btn.textContent = '⏳ Deleting…';
      deleteVideo(currentVideo.publicId)
        .then(function(res) {
          if (res.result === 'ok') {
            allVideos = allVideos.filter(function(v){ return v.public_id !== currentVideo.publicId; });
            updateStats();
            renderGrid(allVideos);
            showToast('success', 'Video deleted.');
            closeModal();
          } else {
            showToast('error', 'Delete failed.');
            btn.disabled = false; btn.textContent = '🗑 Delete'; btn.classList.remove('confirm-del');
          }
        });
    } else {
      btn.classList.add('confirm-del');
      btn.textContent = '⚠ Confirm Delete';
      setTimeout(function() {
        if (btn.textContent.includes('Confirm')) {
          btn.classList.remove('confirm-del'); btn.textContent = '🗑 Delete';
        }
      }, 3000);
    }
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeModal();
  });

  /* ══════════════════════════════════════════════════════════
     SEARCH
     ══════════════════════════════════════════════════════════ */
  function filterVideos() {
    var q = document.getElementById('search-input').value.toLowerCase().trim();
    var filtered = q ? allVideos.filter(function(v){
      return v.public_id.toLowerCase().includes(q);
    }) : allVideos;
    renderGrid(filtered);
  }

  /* ══════════════════════════════════════════════════════════
     STATS
     ══════════════════════════════════════════════════════════ */
  function updateStats() {
    document.getElementById('stat-count').innerHTML = allVideos.length + '<span>files</span>';
    var totalBytes = allVideos.reduce(function(s,v){ return s + (v.bytes||0); }, 0);
    var gb = (totalBytes / (1024*1024*1024));
    if (gb >= 0.1) {
      document.getElementById('stat-size').innerHTML = gb.toFixed(2) + '<span>GB</span>';
    } else {
      document.getElementById('stat-size').innerHTML = (totalBytes/(1024*1024)).toFixed(0) + '<span>MB</span>';
    }
  }

  /* ══════════════════════════════════════════════════════════
     HELPERS
     ══════════════════════════════════════════════════════════ */
  function formatDuration(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function showToast(type, msg) {
    var c  = document.getElementById('toast-container');
    var el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    c.appendChild(el);
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { el.classList.add('show'); });
    });
    setTimeout(function() {
      el.classList.remove('show');
      setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
    }, 3200);
  }
  