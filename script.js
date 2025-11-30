// 浏览器主页Tab插件核心功能

// 全局变量
let currentEngine = 'default';
let searchHistory = [];
let shortcuts = [];
let isRecording = false;
let recognition = null;
let editingShortcutId = null;

// 全局设置对象
window.settings = {
    voiceKeyword: '搜索',
    voiceContinuous: false,
    openInNewTab: false
};

// SortableJS拖拽排序功能
let sortableFolders = null;
let sortableWebsites = null;
let sortableFolderContent = null;

// 语音搜索相关变量
let searchCommandDetected = false;
let searchKeyword = '';
let lastSpeechTime = 0;
let timeWindow = 1000; // 时间窗口（毫秒）
let delayTimer = null;
let delayTime = 1500; // 延迟计时时间（毫秒）


// 搜索引擎配置
const searchEngines = {
    default: 'https://www.bing.com/search?q=',
    baidu: 'https://www.baidu.com/s?wd=',
    sogou: 'https://www.sogou.com/web?query=',
    zhihu: 'https://www.zhihu.com/search?q=',
    bilibili: 'https://search.bilibili.com/all?keyword=',
    douyin: 'https://www.douyin.com/search/',
    weibo: 'https://s.weibo.com/weibo?q=',
    quark: 'https://ai.quark.cn/s/8NTevd22p2uaEwJrI3?q='
};

// DOM元素
const elements = {
    searchInput: document.getElementById('search-input'),
    searchBtn: document.getElementById('search-btn'),
    voiceBtn: document.getElementById('voice-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    searchSuggestions: document.getElementById('search-suggestions'),
    engineBtns: document.querySelectorAll('.engine-btn'),
    foldersGrid: document.getElementById('folders-grid'),
    websitesGrid: document.getElementById('websites-grid'),
    addShortcutBtn: document.getElementById('add-shortcut-btn'),
    addFolderBtn: document.getElementById('add-folder-btn'),

    shortcutModal: document.getElementById('shortcut-modal'),
    closeModal: document.getElementById('close-modal'),
    cancelModal: document.getElementById('cancel-modal'),
    shortcutForm: document.getElementById('shortcut-form'),
    modalTitle: document.getElementById('modal-title'),
    shortcutName: document.getElementById('shortcut-name'),
    shortcutUrl: document.getElementById('shortcut-url'),
    shortcutIcon: document.getElementById('shortcut-icon'),
    iconPreview: document.getElementById('icon-preview'),
    getFaviconBtn: document.getElementById('get-favicon-btn'),
    // 自定义消息弹窗元素
    messageModal: document.getElementById('message-modal'),
    closeMessageModal: document.getElementById('close-message-modal'),
    messageOkBtn: document.getElementById('message-ok-btn'),
    messageContent: document.getElementById('message-content'),
    messageModalTitle: document.getElementById('message-modal-title'),
    // 文件夹名称输入弹窗元素
    folderModal: document.getElementById('folder-modal'),
    closeFolderModal: document.getElementById('close-folder-modal'),
    cancelFolderModal: document.getElementById('cancel-folder-modal'),
    folderForm: document.getElementById('folder-form'),
    folderName: document.getElementById('folder-name'),
    folderModalTitle: document.getElementById('folder-modal-title'),
    // 文件夹内容弹窗元素
    folderContentModal: document.getElementById('folder-content-modal'),
    closeFolderContentModal: document.getElementById('close-folder-content-modal'),
    closeFolderContentBtn: document.getElementById('close-folder-content'),
    folderContent: document.getElementById('folder-content'),
    folderContentModalTitle: document.getElementById('folder-content-modal-title'),
    // 设置弹窗元素
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsModal: document.getElementById('close-settings-modal'),
    cancelSettingsModal: document.getElementById('cancel-settings-modal'),
    settingsForm: document.getElementById('settings-form'),
    settingsModalTitle: document.getElementById('settings-modal-title'),
    searchEngineSelect: document.getElementById('search-engine'),
    voiceContinuousCheckbox: document.getElementById('voice-continuous'),
    voiceKeywordInput: document.getElementById('voice-keyword'),
    openInNewTabCheckbox: document.getElementById('open-in-new-tab')
};

// 初始化应用
function init() {
    // 加载本地数据
    loadData();
    
    // 初始化设置
    initSettings();
    
    // 渲染初始内容
    renderShortcuts();
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 初始化语音识别
    initSpeechRecognition();
    
    // 初始化SortableJS拖拽排序
    setTimeout(() => {
        initSortable();
    }, 100);
    
    // 为整个文档添加拖拽事件监听器，处理从文件夹拖出到任意位置的情况
    document.body.addEventListener('dragover', function(e) {
        // 允许在任意位置拖拽，但不添加样式
        e.preventDefault();
    });
    
    // 为网站直达区域添加拖拽事件监听器
    elements.websitesGrid.addEventListener('dragover', function(e) {
        // 允许拖拽，但不添加样式
        e.preventDefault();
    });
    elements.websitesGrid.addEventListener('drop', handleDrop);
    
    document.body.addEventListener('drop', function(e) {
        e.preventDefault();
        
        // 检查是否正在拖拽卡片
        if (draggedItem && draggedFromFolderId) {
            // 从原文件夹移除
            const sourceFolder = shortcuts.find(folder => folder.id === draggedFromFolderId);
            if (sourceFolder && sourceFolder.children) {
                sourceFolder.children = sourceFolder.children.filter(item => item.id !== draggedItem.id);
            }
            
            // 添加到根目录的第一个位置
            shortcuts.unshift(draggedItem);
            
            // 保存并重新渲染
            saveShortcuts();
            renderShortcuts();
            
            // 如果当前打开了文件夹内容弹窗，重新渲染文件夹内容
            if (!elements.folderContentModal.classList.contains('hidden')) {
                const currentFolderName = elements.folderContentModalTitle.textContent;
                const currentFolder = shortcuts.find(folder => folder.name === currentFolderName);
                if (currentFolder) {
                    openFolderContentModal(currentFolder);
                }
            }
            
            // 重置拖拽状态
            draggedElement = null;
            draggedItem = null;
            draggedFromFolderId = null;
        }
    });
}

// 加载本地数据
function loadData() {
    // 加载搜索历史
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
        searchHistory = JSON.parse(savedHistory);
    }
    
    // 加载直达卡片
    const savedShortcuts = localStorage.getItem('shortcuts');
    if (savedShortcuts) {
        shortcuts = JSON.parse(savedShortcuts);
    } else {
        // 默认直达卡片
        shortcuts = [
            { id: '1', name: '百度', url: 'https://www.baidu.com', icon: 'https://www.baidu.com/favicon.ico', type: 'shortcut' },
            { id: '2', name: '知乎', url: 'https://www.zhihu.com', icon: 'https://www.zhihu.com/favicon.ico', type: 'shortcut' },
            { id: '3', name: 'B站', url: 'https://www.bilibili.com', icon: 'https://www.bilibili.com/favicon.ico', type: 'shortcut' }
        ];
        saveShortcuts();
    }
    
    // 过滤掉谷歌相关的快捷卡片
    shortcuts = filterGoogleShortcuts(shortcuts);
}

// 过滤谷歌相关的快捷卡片
function filterGoogleShortcuts(items) {
    return items.filter(item => {
        // 检查是否是谷歌相关的卡片
        const isGoogleItem = item.name.includes('谷歌') || 
                           item.name.includes('Google') || 
                           (item.url && (item.url.includes('google.com') || 
                           item.url.includes('google.cn')));
        
        if (isGoogleItem) {
            return false; // 过滤掉谷歌相关的卡片
        }
        
        // 如果是文件夹，递归过滤其内部的卡片
        if (item.type === 'folder' && item.children) {
            item.children = filterGoogleShortcuts(item.children);
        }
        
        return true;
    });
}

// 保存数据到本地存储
function saveSearchHistory() {
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
}

function saveShortcuts() {
    // 过滤掉谷歌相关的快捷卡片后再保存
    const filteredShortcuts = filterGoogleShortcuts(shortcuts);
    localStorage.setItem('shortcuts', JSON.stringify(filteredShortcuts));
}

// 绑定事件监听器
function bindEventListeners() {
    // 搜索输入事件
    elements.searchInput.addEventListener('input', handleSearchInput);
    elements.searchInput.addEventListener('keypress', handleSearchKeypress);
    elements.searchInput.addEventListener('focus', showSearchSuggestions);
    // 点击搜索框时停止语音识别
    elements.searchInput.addEventListener('click', function() {
        if (isRecording && recognition) {
            recognition.stop();
            // 清除所有计时器
            if (delayTimer) {
                clearTimeout(delayTimer);
                delayTimer = null;
            }
            // 重置状态
            searchCommandDetected = false;
            searchKeyword = '';
        }
    });
    
    // 搜索按钮事件
    elements.searchBtn.addEventListener('click', performSearch);
    
    // 点击外部关闭搜索建议
    document.addEventListener('click', (e) => {
        if (!elements.searchSuggestions.contains(e.target) && e.target !== elements.searchInput) {
            hideSearchSuggestions();
        }
    });
    
    // 语音输入按钮事件
    elements.voiceBtn.addEventListener('click', toggleVoiceInput);
    
    // 设置按钮事件
    elements.settingsBtn.addEventListener('click', showSettingsModal);
    
    // 设置弹窗事件
    elements.closeSettingsModal.addEventListener('click', closeSettingsModal);
    elements.cancelSettingsModal.addEventListener('click', closeSettingsModal);
    elements.settingsForm.addEventListener('submit', handleSettingsSubmit);
    
    // 点击设置弹窗外部关闭
    elements.settingsModal.addEventListener('click', (e) => {
        if (e.target === elements.settingsModal) {
            closeSettingsModal();
        }
    });
    
    // 搜索引擎切换
    elements.engineBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchSearchEngine(e.target.dataset.engine);
        });
    });
    
    // 直达卡片相关事件
    elements.addShortcutBtn.addEventListener('click', openAddShortcutModal);
    elements.closeModal.addEventListener('click', closeShortcutModal);
    elements.cancelModal.addEventListener('click', closeShortcutModal);
    elements.shortcutForm.addEventListener('submit', handleShortcutSubmit);
    elements.shortcutIcon.addEventListener('change', handleIconUpload);
    elements.getFaviconBtn.addEventListener('click', handleGetFavicon);
    
    // 新建文件夹按钮事件
    if (elements.addFolderBtn) {
        elements.addFolderBtn.addEventListener('click', () => {
            showFolderModal('新建文件夹', (folderName) => {
                addFolder(folderName);
            });
        });
    }
    

    
    // 点击模态框外部关闭
    elements.shortcutModal.addEventListener('click', (e) => {
        if (e.target === elements.shortcutModal) {
            closeShortcutModal();
        }
    });
    
    // 消息弹窗事件绑定
    elements.closeMessageModal.addEventListener('click', () => closeMessageModal(false));
    elements.messageOkBtn.addEventListener('click', () => closeMessageModal(true));
    // 添加取消按钮事件监听
    const messageCancelBtn = document.getElementById('message-cancel-btn');
    if (messageCancelBtn) {
        messageCancelBtn.addEventListener('click', () => closeMessageModal(false));
    }
    elements.messageModal.addEventListener('click', (e) => {
        if (e.target === elements.messageModal) {
            closeMessageModal(false);
        }
    });
    
    // 文件夹弹窗事件绑定
    elements.closeFolderModal.addEventListener('click', closeFolderModal);
    elements.cancelFolderModal.addEventListener('click', closeFolderModal);
    elements.folderModal.addEventListener('click', (e) => {
        if (e.target === elements.folderModal) {
            closeFolderModal();
        }
    });
    
    // 文件夹内容弹窗事件绑定
    elements.closeFolderContentModal.addEventListener('click', closeFolderContentModal);
    elements.closeFolderContentBtn.addEventListener('click', closeFolderContentModal);
    elements.folderContentModal.addEventListener('click', (e) => {
        if (e.target === elements.folderContentModal) {
            closeFolderContentModal();
        }
    });
}

// 搜索功能
function handleSearchInput() {
    const query = elements.searchInput.value.trim();
    
    // 知乎、B站、抖音、微博、夸克不显示搜索建议和搜索历史
    if (['zhihu', 'bilibili', 'douyin', 'weibo', 'quark'].includes(currentEngine)) {
        hideSearchSuggestions();
        return;
    }
    
    if (query) {
        showSearchSuggestions();
        updateSearchSuggestions(query);
    } else {
        showSearchHistory();
    }
}

function handleSearchKeypress(e) {
    if (e.key === 'Enter') {
        performSearch();
    }
}

function performSearch() {
    const query = elements.searchInput.value.trim();
    if (!query) return;
    
    // 添加到搜索历史
    addToSearchHistory(query);
    
    // 执行搜索
    const searchUrl = searchEngines[currentEngine] + encodeURIComponent(query);
    
    // 根据设置决定在当前标签页还是新标签页打开搜索结果
    if (window.settings.openInNewTab) {
        // 在新标签页打开搜索结果
        window.open(searchUrl, '_blank');
    } else {
        // 在当前标签页打开搜索结果
        window.location.href = searchUrl;
    }
}

function addToSearchHistory(query) {
    // 移除重复项
    searchHistory = searchHistory.filter(item => item !== query);
    
    // 添加到开头
    searchHistory.unshift(query);
    
    // 限制历史记录数量
    if (searchHistory.length > 10) {
        searchHistory = searchHistory.slice(0, 10);
    }
    
    saveSearchHistory();
}

function removeFromSearchHistory(query) {
    searchHistory = searchHistory.filter(item => item !== query);
    saveSearchHistory();
}

function showSearchSuggestions() {
    // 知乎、B站、抖音、微博、夸克不显示搜索建议和搜索历史
    if (['zhihu', 'bilibili', 'douyin', 'weibo', 'quark'].includes(currentEngine)) {
        return;
    }
    
    elements.searchSuggestions.classList.remove('hidden');
    // 如果搜索框为空，显示搜索历史
    const query = elements.searchInput.value.trim();
    if (!query) {
        showSearchHistory();
    }
}

function hideSearchSuggestions() {
    elements.searchSuggestions.classList.add('hidden');
}

function updateSearchSuggestions(query) {
    let suggestions;
    
    // 根据不同搜索引擎返回不同的搜索建议
    if (currentEngine === 'default') {
        // 必应搜索引擎返回结构化搜索建议
        suggestions = [
            { text: `搜网页: ${query}`, url: `https://cn.bing.com/search?q=${encodeURIComponent(query)}` },
            { text: `搜图片: ${query}`, url: `https://cn.bing.com/images/search?q=${encodeURIComponent(query)}` },
            { text: `搜视频: ${query}`, url: `https://cn.bing.com/videos/search?q=${encodeURIComponent(query)}` },
            { text: `搜学术: ${query}`, url: `https://cn.bing.com/academic/search?q=${encodeURIComponent(query)}` },
            { text: `搜词典: ${query}`, url: `https://cn.bing.com/dict/search?q=${encodeURIComponent(query)}` },
            { text: `搜地图: ${query}`, url: `https://cn.bing.com/maps?q=${encodeURIComponent(query)}` }
        ];
    } else if (currentEngine === 'baidu') {
        // 百度搜索引擎返回结构化搜索建议
        suggestions = [
            { text: `搜网页: ${query}`, url: `https://www.baidu.com/s?wd=${encodeURIComponent(query)}` },
            { text: `搜图片: ${query}`, url: `https://image.baidu.com/search/index?tn=baiduimage&fm=result&ie=utf-8&word=${encodeURIComponent(query)}` },
            { text: `搜视频: ${query}`, url: `https://www.baidu.com/sf/vsearch?pd=video&tn=vsearch&wd=${encodeURIComponent(query)}` },
            { text: `${query} 百度百科`, url: `https://baike.baidu.com/item/${encodeURIComponent(query)}` }
        ];
    } else if (currentEngine === 'sogou') {
        // 搜狗搜索引擎返回结构化搜索建议
        suggestions = [
            { text: `搜网页: ${query}`, url: `https://www.sogou.com/web?query=${encodeURIComponent(query)}` },
            { text: `搜图片: ${query}`, url: `https://pic.sogou.com/pics?query=${encodeURIComponent(query)}` },
            { text: `搜视频: ${query}`, url: `https://v.sogou.com/v?ie=utf8&query=${encodeURIComponent(query)}` },
            { text: `${query} 搜狗百科`, url: `https://baike.sogou.com/v76849134.htm?fromTitle=${encodeURIComponent(query)}` }
        ];
    } else if (['zhihu', 'bilibili', 'douyin', 'weibo', 'quark'].includes(currentEngine)) {
        // 知乎、B站、抖音、微博、夸克不显示搜索建议
        suggestions = [];
    }
    
    renderSearchSuggestions(suggestions);
}

function showSearchHistory() {
    renderSearchSuggestions(searchHistory, true);
}

function renderSearchSuggestions(items, isHistory = false) {
    elements.searchSuggestions.innerHTML = '';
    
    items.forEach(item => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        
        // 检查item是字符串还是结构化对象
        const isStructured = typeof item === 'object' && item !== null;
        const displayText = isStructured ? item.text : item;
        
        suggestionItem.innerHTML = `
            <span>${displayText}</span>
            ${isHistory ? '<span class="delete-btn">×</span>' : ''}
        `;
        
        // 点击搜索建议
                suggestionItem.addEventListener('click', (e) => {
                    if (e.target.classList.contains('delete-btn')) {
                        e.stopPropagation();
                        removeFromSearchHistory(item);
                        showSearchHistory();
                    } else {
                        if (isStructured) {
                            // 提取搜索关键词并添加到历史记录
                            const query = elements.searchInput.value.trim();
                            if (query) {
                                addToSearchHistory(query);
                            }
                            // 根据设置决定在当前标签页还是新标签页打开链接
                            if (window.settings.openInNewTab) {
                                window.open(item.url, '_blank');
                            } else {
                                window.location.href = item.url;
                            }
                        } else {
                            // 传统搜索建议处理
                            elements.searchInput.value = item;
                            performSearch();
                        }
                    }
                });
        
        elements.searchSuggestions.appendChild(suggestionItem);
    });
}

// 搜索引擎切换
function switchSearchEngine(engine) {
    // 更新当前搜索引擎
    currentEngine = engine;
    
    // 更新按钮状态
    elements.engineBtns.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.engine === engine) {
            btn.classList.add('active');
        }
    });
}

// 语音识别初始化
function initSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';
        
        recognition.onstart = () => {
            isRecording = true;
            elements.voiceBtn.classList.add('recording');
            // 重置语音搜索状态
            searchCommandDetected = false;
            searchKeyword = '';
            lastSpeechTime = 0;
            if (delayTimer) {
                clearTimeout(delayTimer);
                delayTimer = null;
            }
        };
        
        recognition.onresult = (event) => {
            // 累积所有识别结果
            let transcript = '';
            let isFinalResult = false;
            
            // 遍历所有结果，将它们的文本拼接起来
            // 这样可以保留所有已识别的内容
            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                transcript += result[0].transcript;
                if (result.isFinal) {
                    isFinalResult = true;
                }
            }
            
            // 更新搜索框显示，显示完整的累积结果
            elements.searchInput.value = transcript;
            
            // 更新最后语音时间
            lastSpeechTime = Date.now();
            
            // 检查是否检测到搜索命令
            if (transcript.startsWith(settings.voiceKeyword)) {
                // 提取搜索关键词，去除可能的逗号和句号
                searchKeyword = transcript.substring(settings.voiceKeyword.length).replace(/[，。.]/g, '').trim();
                
                if (isFinalResult) {
                    // 如果是最终结果，立即执行搜索
                    performVoiceSearch();
                } else {
                    // 如果是中间结果，启动延迟计时器
                    startDelayTimer();
                }
            } else {
                // 对于非搜索指令，检查是否需要根据设置停止识别
                // 只清除延迟计时器，避免非搜索指令触发搜索
                if (delayTimer) {
                    clearTimeout(delayTimer);
                    delayTimer = null;
                }
                
                // 如果连续识别设置被禁用，且检测到句末标点，停止识别
                if (!window.settings.voiceContinuous && isFinalResult && (transcript.includes('。') || transcript.includes('.'))) {
                    recognition.stop();
                }
            }
        };
        
        recognition.onend = () => {
                isRecording = false;
                elements.voiceBtn.classList.remove('recording');
                // 不立即清除计时器，让延迟计时器有机会执行搜索
                // 重置状态将在performVoiceSearch函数中完成
            };
        
        recognition.onerror = (event) => {
            console.error('语音识别错误:', event.error);
            isRecording = false;
            elements.voiceBtn.classList.remove('recording');
            // 清除所有计时器
            if (delayTimer) {
                clearTimeout(delayTimer);
                delayTimer = null;
            }
            // 重置状态
            searchCommandDetected = false;
            searchKeyword = '';
        };
    }
}

// 开始延迟计时
function startDelayTimer() {
    // 清除之前的计时器
    if (delayTimer) {
        clearTimeout(delayTimer);
    }
    
    // 设置新的延迟计时器
    delayTimer = setTimeout(() => {
        // 检查是否在时间窗口内没有新的语音输入
        const currentTime = Date.now();
        if (currentTime - lastSpeechTime >= timeWindow) {
            // 执行搜索
            performVoiceSearch();
        } else {
            // 继续等待
            startDelayTimer();
        }
    }, delayTime);
}

// 执行语音搜索
function performVoiceSearch() {
    if (searchKeyword) {
        // 设置搜索关键词
        elements.searchInput.value = searchKeyword;
        // 执行搜索
        performSearch();
        // 停止录音
        if (recognition && isRecording) {
            recognition.stop();
        }
        // 重置状态
        searchCommandDetected = false;
        searchKeyword = '';
        // 清除计时器
        if (delayTimer) {
            clearTimeout(delayTimer);
            delayTimer = null;
        }
    }
}

// 切换语音输入
function toggleVoiceInput() {
    if (!recognition) {
        showMessageModal('您的浏览器不支持语音识别功能', '提示');
        return;
    }
    
    if (isRecording) {
        recognition.stop();
        // 清除所有计时器
        if (delayTimer) {
            clearTimeout(delayTimer);
            delayTimer = null;
        }
        // 重置状态
        searchCommandDetected = false;
        searchKeyword = '';
    } else {
        // 开始录音前清空搜索框
        elements.searchInput.value = '';
        // 重置状态
        searchCommandDetected = false;
        searchKeyword = '';
        lastSpeechTime = 0;
        
        // 根据设置调整recognition.continuous属性
        recognition.continuous = window.settings.voiceContinuous;
        
        // 开始录音
        recognition.start();
    }
}

// 直达卡片功能
function renderShortcuts() {
    // 清空两个网格
    elements.foldersGrid.innerHTML = '';
    elements.websitesGrid.innerHTML = '';
    
    // 使用文档片段批量添加元素，减少DOM操作次数
    const foldersFragment = document.createDocumentFragment();
    const websitesFragment = document.createDocumentFragment();
    
    shortcuts.forEach(shortcut => {
        if (shortcut.type === 'folder') {
            const folderElement = createFolderElement(shortcut);
            foldersFragment.appendChild(folderElement);
        } else {
            const shortcutCard = createShortcutCard(shortcut);
            websitesFragment.appendChild(shortcutCard);
        }
    });
    
    // 一次性添加到DOM中
    elements.foldersGrid.appendChild(foldersFragment);
    elements.websitesGrid.appendChild(websitesFragment);
}

function createShortcutCard(shortcut) {
    const card = document.createElement('div');
    card.className = 'shortcut-card';
    card.draggable = true;
    card.dataset.id = shortcut.id;
    card.dataset.type = 'shortcut';
    
    // 先创建基本结构，使用默认图标占位
    card.innerHTML = `
        <button class="shortcut-delete">×</button>
        <img src="${shortcut.icon}" alt="${shortcut.name}" class="shortcut-icon" draggable="false">
        <span class="shortcut-name">${shortcut.name}</span>
    `;
    
    // 处理图标，确保正确显示
    const imgElement = card.querySelector('.shortcut-icon');
    processIconForDisplay(shortcut.icon, imgElement);
    
    // 点击访问网站
    card.addEventListener('click', (e) => {
        if (!e.target.classList.contains('shortcut-delete')) {
            // 在当前标签页打开链接
            window.location.href = shortcut.url;
        }
    });
    
    // 删除按钮事件
    const deleteBtn = card.querySelector('.shortcut-delete');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteShortcut(shortcut.id);
    });
    
    // 拖拽事件 - 保留用于文件夹和网站之间的移动操作
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('dragenter', handleDragOver);
    card.addEventListener('dragover', handleDragOver);
    card.addEventListener('dragleave', handleDragLeave);
    card.addEventListener('drop', handleDrop);
    
    return card;
}

// 处理图标，确保在快捷卡片中正确显示
function processIconForDisplay(iconUrl, imgElement) {
    // 直接使用原始图标URL，避免Canvas处理导致的跨域问题
    imgElement.src = iconUrl;
    
    // 设置错误处理，使用一个更通用的默认图标或保持原样
    imgElement.onerror = () => {
        console.error('加载图标失败:', iconUrl);
        // 不使用百度图标作为默认，保持原始图标URL或使用更通用的默认图标
        // 可以考虑使用一个本地默认图标或其他通用图标
        imgElement.src = iconUrl; // 保持原样，或替换为其他通用图标
    };
}

// 创建文件夹元素
function createFolderElement(folder) {
    const folderCard = document.createElement('div');
    folderCard.className = 'folder-card';
    folderCard.draggable = true;
    folderCard.dataset.id = folder.id;
    folderCard.dataset.type = 'folder';
    
    folderCard.innerHTML = `
        <button class="shortcut-delete">×</button>
        <div class="shortcut-icon" style="font-size: 48px;">📁</div>
        <span class="shortcut-name">${folder.name}</span>
    `;
    
    // 点击打开文件夹内容弹窗
    folderCard.addEventListener('click', (e) => {
        if (!e.target.classList.contains('shortcut-delete')) {
            openFolderContentModal(folder);
        }
    });
    
    // 删除按钮事件
    const deleteBtn = folderCard.querySelector('.shortcut-delete');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteShortcut(folder.id);
    });
    
    // 拖拽事件 - 保留用于文件夹和网站之间的移动操作
    folderCard.addEventListener('dragstart', handleDragStart);
    folderCard.addEventListener('dragend', handleDragEnd);
    folderCard.addEventListener('dragenter', handleDragOver);
    folderCard.addEventListener('dragover', handleDragOver);
    folderCard.addEventListener('dragleave', handleDragLeave);
    folderCard.addEventListener('drop', handleDrop);
    
    return folderCard;
}

// 打开文件夹内容弹窗
function openFolderContentModal(folder) {
    elements.folderContentModalTitle.textContent = folder.name;
    elements.folderContent.innerHTML = '';
    
    // 创建网格容器
    const gridContainer = document.createElement('div');
    gridContainer.className = 'folder-content-grid';
    gridContainer.id = 'folder-content-grid';
    
    // 渲染文件夹内的子卡片
    if (folder.children && folder.children.length > 0) {
        folder.children.forEach(child => {
            const childCard = createShortcutCard(child);
            gridContainer.appendChild(childCard);
        });
    } else {
        gridContainer.innerHTML = '<div class="empty-folder">文件夹为空</div>';
    }
    
    // 将网格容器添加到文件夹内容区域
    elements.folderContent.appendChild(gridContainer);
    
    elements.folderContentModal.classList.remove('hidden');
    
    // 为文件夹内容网格添加拖拽事件监听器
    gridContainer.addEventListener('dragover', function(e) {
        // 允许拖拽，但不添加样式
        e.preventDefault();
    });
    gridContainer.addEventListener('drop', handleDrop);
    
    // 初始化文件夹内容区域的拖拽排序
    setTimeout(() => {
        initFolderContentSortable();
    }, 100);
}

// 关闭文件夹内容弹窗
function closeFolderContentModal() {
    elements.folderContentModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// 设置管理相关函数

// 显示设置弹窗
function showSettingsModal() {
    // 加载保存的设置
    const settings = loadSettings();
    
    // 设置表单值
    elements.searchEngineSelect.value = settings.defaultSearchEngine || currentEngine;
    elements.voiceContinuousCheckbox.checked = settings.voiceContinuous || false;
    elements.voiceKeywordInput.value = settings.voiceKeyword || '搜索';
    elements.openInNewTabCheckbox.checked = settings.openInNewTab || false;
    
    elements.settingsModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// 关闭设置弹窗
function closeSettingsModal() {
    elements.settingsModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

// 处理设置提交
function handleSettingsSubmit(e) {
    e.preventDefault();
    
    // 获取表单值
    const settings = {
        defaultSearchEngine: elements.searchEngineSelect.value,
        voiceContinuous: elements.voiceContinuousCheckbox.checked,
        voiceKeyword: elements.voiceKeywordInput.value.trim() || '搜索',
        openInNewTab: elements.openInNewTabCheckbox.checked
    };
    
    // 保存设置
    saveSettings(settings);
    
    // 应用设置
    applySettings(settings);
    
    // 显示成功消息
    showMessageModal('设置已保存！', '成功', () => {
        closeSettingsModal();
    });
}

// 加载设置
function loadSettings() {
    try {
        const settingsStr = localStorage.getItem('settings');
        return settingsStr ? JSON.parse(settingsStr) : {};
    } catch (error) {
        console.error('加载设置失败:', error);
        return {};
    }
}

// 保存设置
function saveSettings(settings) {
    try {
        localStorage.setItem('settings', JSON.stringify(settings));
    } catch (error) {
        console.error('保存设置失败:', error);
        showMessageModal('保存设置失败！', '错误');
    }
}

// 应用设置
function applySettings(settings) {
    // 应用默认搜索引擎
    if (settings.defaultSearchEngine) {
        currentEngine = settings.defaultSearchEngine;
        switchSearchEngine(currentEngine);
    }
    
    // 应用语音搜索关键词
    if (settings.voiceKeyword) {
        window.settings.voiceKeyword = settings.voiceKeyword;
    }
    
    // 应用连续语音识别设置
    if (settings.voiceContinuous !== undefined) {
        window.settings.voiceContinuous = settings.voiceContinuous;
    }
    
    // 应用新标签页打开设置
    if (settings.openInNewTab !== undefined) {
        window.settings.openInNewTab = settings.openInNewTab;
    }
}

// 初始化设置
function initSettings() {
    const settings = loadSettings();
    applySettings(settings);
}

// 拖拽排序功能
let draggedElement = null;
let draggedItem = null;
let draggedFromFolderId = null;

// 初始化SortableJS拖拽排序
function initSortable() {
    // 检查SortableJS是否已加载
    if (typeof Sortable === 'undefined') {
        console.log('SortableJS not loaded, skipping drag and drop initialization');
        return;
    }
    
    // 初始化文件夹区域拖拽排序
    if (elements.foldersGrid) {
        sortableFolders = new Sortable(elements.foldersGrid, {
            group: 'folders',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            filter: '.shortcut-delete', // 过滤删除按钮
            onEnd: function(evt) {
                // 拖拽结束后更新数据顺序
                updateFoldersOrder();
            }
        });
    }
    
    // 初始化网站区域拖拽排序
    if (elements.websitesGrid) {
        sortableWebsites = new Sortable(elements.websitesGrid, {
            group: 'websites',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            filter: '.shortcut-delete', // 过滤删除按钮
            onEnd: function(evt) {
                // 拖拽结束后更新数据顺序
                updateWebsitesOrder();
            }
        });
    }
}

// 更新文件夹顺序
function updateFoldersOrder() {
    const folderElements = elements.foldersGrid.querySelectorAll('.folder-card');
    const newFolders = [];
    const nonFolders = [];
    
    // 分离文件夹和非文件夹项
    shortcuts.forEach(item => {
        if (item.type === 'folder') {
            // 稍后会按照新顺序添加
        } else {
            nonFolders.push(item);
        }
    });
    
    // 按照新的DOM顺序添加文件夹
    folderElements.forEach(element => {
        const folderId = element.dataset.id;
        const folder = shortcuts.find(item => item.id === folderId);
        if (folder) {
            newFolders.push(folder);
        }
    });
    
    // 合并文件夹和非文件夹，保持文件夹在前
    shortcuts = [...newFolders, ...nonFolders];
    saveShortcuts();
}

// 更新网站顺序
function updateWebsitesOrder() {
    const websiteElements = elements.websitesGrid.querySelectorAll('.shortcut-card');
    const folders = [];
    const newWebsites = [];
    
    // 分离文件夹和网站
    shortcuts.forEach(item => {
        if (item.type === 'folder') {
            folders.push(item);
        } else {
            // 稍后会按照新顺序添加
        }
    });
    
    // 按照新的DOM顺序添加网站
    websiteElements.forEach(element => {
        const websiteId = element.dataset.id;
        const website = shortcuts.find(item => item.id === websiteId && item.type !== 'folder');
        if (website) {
            newWebsites.push(website);
        }
    });
    
    // 合并文件夹和网站，保持文件夹在前
    shortcuts = [...folders, ...newWebsites];
    saveShortcuts();
}

// 初始化文件夹内容区域的拖拽排序
function initFolderContentSortable() {
    // 检查SortableJS是否已加载
    if (typeof Sortable === 'undefined') {
        console.log('SortableJS not loaded, skipping folder content drag and drop initialization');
        return;
    }
    
    const folderContentGrid = document.getElementById('folder-content-grid');
    if (folderContentGrid) {
        // 销毁之前的实例（如果存在）
        if (sortableFolderContent) {
            sortableFolderContent.destroy();
        }
        
        sortableFolderContent = new Sortable(folderContentGrid, {
            group: 'folder-content',
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            filter: '.shortcut-delete', // 过滤删除按钮
            onEnd: function(evt) {
                // 拖拽结束后更新文件夹内内容顺序
                updateFolderContentOrder();
            }
        });
    }
}

// 更新文件夹内容顺序
function updateFolderContentOrder() {
    const currentFolderName = elements.folderContentModalTitle.textContent;
    const currentFolder = shortcuts.find(folder => folder.name === currentFolderName);
    if (!currentFolder) return;
    
    const newChildren = [];
    const childElements = document.querySelectorAll('#folder-content-grid .shortcut-card');
    childElements.forEach(element => {
        const childId = element.dataset.id;
        const child = currentFolder.children.find(item => item.id === childId);
        if (child) {
            newChildren.push(child);
        }
    });
    
    currentFolder.children = newChildren;
    saveShortcuts();
}

function handleDragStart(e) {
    draggedElement = this;
    this.classList.add('dragging');
    
    // 设置拖拽数据
    e.dataTransfer.setData('text/plain', this.dataset.id);
    
    // 查找拖拽项的完整信息
    const draggedId = this.dataset.id;
    draggedFromFolderId = null;
    
    // 先在根目录查找
    let draggedIndex = shortcuts.findIndex(item => item.id === draggedId);
    if (draggedIndex !== -1) {
        draggedItem = shortcuts[draggedIndex];
    } else {
        // 在所有文件夹中查找
        for (const folder of shortcuts.filter(item => item.type === 'folder')) {
            if (folder.children) {
                draggedIndex = folder.children.findIndex(item => item.id === draggedId);
                if (draggedIndex !== -1) {
                    draggedItem = folder.children[draggedIndex];
                    draggedFromFolderId = folder.id;
                    break;
                }
            }
        }
    }
}

function handleDragOver(e) {
    // 阻止默认行为，允许拖拽
    e.preventDefault();
    
    // 只允许拖放到文件夹上时添加高亮，禁止拖放到其他网站卡片上
    // 同时禁止将文件夹拖放到文件夹中
    if (draggedItem && this.dataset.type === 'folder' && draggedItem.type !== 'folder') {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    // 移除拖拽高亮效果
    this.classList.remove('drag-over');
}

function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    
    // 重置拖拽状态变量
    draggedElement = null;
    draggedItem = null;
    draggedFromFolderId = null;
}

function handleDrop(e) {
    e.preventDefault();
    
    // 移除所有高亮
    document.querySelectorAll('.drag-over').forEach(el => {
        el.classList.remove('drag-over');
    });
    
    if (!draggedItem || !draggedElement) return;
    
    // 获取目标元素
    const dropTarget = e.currentTarget;
    const isGridContainer = dropTarget.classList.contains('shortcuts-grid') || dropTarget.classList.contains('folder-content-grid');
    const targetCard = isGridContainer ? e.target.closest('.shortcut-card, .folder-card') : dropTarget;
    
    // 只允许两种拖放操作：
    // 1. 网站卡片拖进文件夹
    // 2. 从文件夹拖出网站卡片到根目录
    let shouldMove = false;
    let targetFolder = null;
    
    // 情况1：拖放到文件夹中
    if (targetCard && targetCard.dataset.type === 'folder' && draggedItem.type !== 'folder') {
        shouldMove = true;
        const folderId = targetCard.dataset.id;
        targetFolder = shortcuts.find(folder => folder.id === folderId);
    }
    // 情况2：从文件夹拖出到根目录
    else if (isGridContainer && draggedFromFolderId && draggedItem.type !== 'folder') {
        shouldMove = true;
    }
    
    // 如果不是允许的拖放操作，直接返回，不执行任何操作
    if (!shouldMove) {
        // 重置拖拽状态
        draggedElement = null;
        draggedItem = null;
        draggedFromFolderId = null;
        return;
    }
    
    // 从原位置移除拖拽项
    if (draggedFromFolderId) {
        // 从文件夹中移除
        const sourceFolder = shortcuts.find(folder => folder.id === draggedFromFolderId);
        if (sourceFolder && sourceFolder.children) {
            sourceFolder.children = sourceFolder.children.filter(item => item.id !== draggedItem.id);
        }
    } else {
        // 从根目录移除
        const draggedIndex = shortcuts.findIndex(item => item.id === draggedItem.id);
        if (draggedIndex !== -1) {
            shortcuts.splice(draggedIndex, 1);
        }
    }
    
    // 将拖拽项添加到目标位置
    if (targetFolder) {
        // 拖放到文件夹中
        if (!targetFolder.children) {
            targetFolder.children = [];
        }
        targetFolder.children.push(draggedItem);
    } else {
        // 拖出到根目录
        shortcuts.unshift(draggedItem);
    }
    
    // 保存并重新渲染
    saveShortcuts();
    renderShortcuts();
    
    // 如果当前打开了文件夹内容弹窗，重新渲染文件夹内容
    if (!elements.folderContentModal.classList.contains('hidden')) {
        const currentFolderName = elements.folderContentModalTitle.textContent;
        const currentFolder = shortcuts.find(folder => folder.name === currentFolderName);
        if (currentFolder) {
            openFolderContentModal(currentFolder);
        }
    }
    
    // 重置拖拽状态
    draggedElement = null;
    draggedItem = null;
    draggedFromFolderId = null;
}

// 模态框操作
function openAddShortcutModal() {
    editingShortcutId = null;
    elements.modalTitle.textContent = '添加直达网站';
    elements.shortcutForm.reset();
    resetIconPreview();
    elements.shortcutModal.classList.remove('hidden');
}

function closeShortcutModal() {
    elements.shortcutModal.classList.add('hidden');
    editingShortcutId = null;
}

function resetIconPreview() {
    elements.iconPreview.innerHTML = `
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="48" height="48" fill="#f0f0f0"/>
            <text x="24" y="30" font-size="24" text-anchor="middle" fill="#999">+</text>
        </svg>
    `;
}

// 自定义消息弹窗功能
let messageCallback = null;

function showMessageModal(message, title = '提示', callback = null) {
    elements.messageModalTitle.textContent = title;
    elements.messageContent.textContent = message;
    elements.messageModal.classList.remove('hidden');
    messageCallback = callback;
}

function closeMessageModal(confirmed = false) {
    elements.messageModal.classList.add('hidden');
    if (messageCallback) {
        messageCallback(confirmed);
        messageCallback = null;
    }
}

// 自定义文件夹名称输入弹窗功能
let folderCallback = null;

function showFolderModal(title = '新建文件夹', callback = null) {
    elements.folderModalTitle.textContent = title;
    elements.folderForm.reset();
    elements.folderModal.classList.remove('hidden');
    folderCallback = callback;
    // 自动聚焦到输入框
    setTimeout(() => {
        elements.folderName.focus();
    }, 100);
}

function closeFolderModal() {
    elements.folderModal.classList.add('hidden');
    folderCallback = null;
}

// 处理文件夹表单提交
function handleFolderSubmit(e) {
    e.preventDefault();
    const folderName = elements.folderName.value.trim();
    if (folderName && folderCallback) {
        folderCallback(folderName);
    }
    closeFolderModal();
}

// 绑定文件夹表单提交事件
elements.folderForm.addEventListener('submit', handleFolderSubmit);

// 处理直达卡片提交
function handleShortcutSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(elements.shortcutForm);
    const shortcutData = {
        name: formData.get('name'),
        url: formData.get('url'),
        icon: elements.iconPreview.innerHTML.includes('img') ? 
            elements.iconPreview.querySelector('img').src : 
            '' // 不使用百度图标作为默认值，留空或使用其他方式处理
    };
    
    if (editingShortcutId) {
        // 编辑现有卡片
        updateShortcut(editingShortcutId, shortcutData);
    } else {
        // 添加新卡片
        addShortcut(shortcutData);
    }
    
    closeShortcutModal();
}

// 添加直达卡片
function addShortcut(shortcutData) {
    const newShortcut = {
        id: Date.now().toString(),
        type: 'shortcut',
        ...shortcutData
    };
    
    shortcuts.push(newShortcut);
    saveShortcuts();
    renderShortcuts();
}

// 添加文件夹
function addFolder(folderName) {
    const newFolder = {
        id: Date.now().toString(),
        name: folderName,
        type: 'folder',
        children: [],
        expanded: true
    };
    
    shortcuts.push(newFolder);
    saveShortcuts();
    renderShortcuts();
}

// 更新直达卡片
function updateShortcut(id, shortcutData) {
    const index = shortcuts.findIndex(shortcut => shortcut.id === id);
    if (index !== -1) {
        shortcuts[index] = {
            ...shortcuts[index],
            ...shortcutData
        };
        saveShortcuts();
        renderShortcuts();
    }
}

// 删除直达卡片或文件夹
function deleteShortcut(id) {
    let item = null;
    let parentFolder = null;
    let isInFolder = false;
    
    // 1. 先在根目录查找
    const rootIndex = shortcuts.findIndex(shortcut => shortcut.id === id);
    if (rootIndex !== -1) {
        item = shortcuts[rootIndex];
    } else {
        // 2. 在所有文件夹中查找
        for (const folder of shortcuts.filter(item => item.type === 'folder')) {
            if (folder.children) {
                const childIndex = folder.children.findIndex(child => child.id === id);
                if (childIndex !== -1) {
                    item = folder.children[childIndex];
                    parentFolder = folder;
                    isInFolder = true;
                    break;
                }
            }
        }
    }
    
    if (!item) return;
    
    // 确认删除
    let confirmMessage;
    if (item.type === 'folder') {
        const childCount = item.children ? item.children.length : 0;
        confirmMessage = `确定要删除文件夹 "${item.name}"${childCount > 0 ? ` 及其包含的 ${childCount} 个项目` : ''}吗？`;
    } else {
        confirmMessage = `确定要删除直达网站 "${item.name}"吗？`;
    }
    
    // 使用自定义消息弹窗进行确认
    showMessageModal(confirmMessage, '确认删除', (confirmed) => {
        if (confirmed) {
            if (isInFolder && parentFolder) {
                // 从文件夹中删除
                parentFolder.children = parentFolder.children.filter(child => child.id !== id);
            } else {
                // 从根目录删除
                shortcuts = shortcuts.filter(shortcut => shortcut.id !== id);
            }
            
            saveShortcuts();
            renderShortcuts();
            
            // 更新文件夹内容弹窗（如果当前打开）
            if (!elements.folderContentModal.classList.contains('hidden')) {
                // 获取当前打开的文件夹名称
                const currentFolderName = elements.folderContentModalTitle.textContent;
                // 查找对应的文件夹对象
                const currentFolder = shortcuts.find(folder => folder.name === currentFolderName);
                if (currentFolder) {
                    // 重新渲染文件夹内容
                    openFolderContentModal(currentFolder);
                }
            }
        }
    });
}

// 处理图标上传
function handleIconUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            let result = event.target.result;
            // 确保ico文件使用正确的MIME类型
            if (file.name.toLowerCase().endsWith('.ico')) {
                // 替换自动生成的MIME类型为正确的image/x-icon
                result = result.replace(/^data:image\/[^;]+/, 'data:image/x-icon');
            }
            
            // 处理图标，确保正确显示
            processIconForPreview(result);
        };
        reader.readAsDataURL(file);
    }
}

// 自动获取网站图标
function handleGetFavicon() {
    const url = elements.shortcutUrl.value.trim(); // 添加trim()去除空格
    
    if (!url) {
        showMessageModal('请输入网站地址', '提示');
        return;
    }
    
    try {
        // 如果URL不包含协议，添加默认的https://
        let fullUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            fullUrl = 'https://' + url;
        }
        
        const urlObj = new URL(fullUrl);
        const domain = urlObj.host;
        
        // 尝试多种图标路径
        const iconUrls = [
            `${urlObj.protocol}//${domain}/favicon.ico`,
            `${urlObj.protocol}//${domain}/favicon.png`,
            `${urlObj.protocol}//${domain}/apple-touch-icon.png`,
            `${urlObj.protocol}//${domain}/apple-touch-icon-precomposed.png`
        ];
        
        // 逐个尝试获取图标
        tryNextIcon(0);
        
        function tryNextIcon(index) {
            if (index >= iconUrls.length) {
                // 所有尝试都失败了，显示默认图标
                showDefaultIcon();
                showMessageModal('图标获取失败，将使用默认图标', '提示');
                return;
            }
            
            const iconUrl = iconUrls[index];
            
            // 对于扩展程序，我们不能直接通过XMLHttpRequest获取跨域资源
            // 直接使用processIconForPreview处理图标，让它自己处理CORS问题
            processIconForPreview(iconUrl, true); // 第二个参数表示这是自动获取的图标
        }
        
        // 暴露tryNextIcon到全局作用域，以便在图片加载失败时调用
        window.tryNextFavicon = tryNextIcon;
    } catch (error) {
        // 显示错误信息给用户
        showMessageModal('请输入有效的网站地址，例如：www.example.com 或 https://www.example.com', 'URL格式错误');
    }
}

// 显示默认图标
function showDefaultIcon() {
    elements.iconPreview.innerHTML = `
        <img src="/favicon.ico" alt="默认图标" style="width: 100%; height: 100%;" onerror="this.onerror=null;this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICAgIDxyZWN0IHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgZmlsbD0iI2YwZjBmMCIvPgogICAgPHRleHQgeD0iMjQiIHk9IjMwIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOTk5Ij4rPC90ZXh0Pgo8L3N2Zz4=';" draggable="false">
    `;
}

// 处理图标，确保正确显示（特别是大尺寸ICO图标）
// addAutoFetch参数表示是否是自动获取的图标
function processIconForPreview(iconUrl, isAutoFetch = false) {
    
    // 如果是自动获取的图标，直接显示而不通过Canvas处理（避免CORS问题）
    if (isAutoFetch) {
        // 直接显示图标，不进行Canvas处理
        const imgElement = document.createElement('img');
        imgElement.src = iconUrl;
        imgElement.alt = "预览";
        imgElement.style.width = "100%";
        imgElement.style.height = "100%";
        imgElement.draggable = false;
        
        // 使用addEventListener替代内联onerror处理器
        imgElement.onerror = () => {
            handleFaviconError(iconUrl);
        };
        
        // 清空预览区域并添加图片
        elements.iconPreview.innerHTML = '';
        elements.iconPreview.appendChild(imgElement);
        return;
    }
    
    const img = new Image();
    // 允许跨域请求
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
        try {
            // 创建Canvas用于处理图标
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 设置Canvas大小为合适的尺寸（48x48像素，与预览区域匹配）
            const targetSize = 48;
            canvas.width = targetSize;
            canvas.height = targetSize;
            
            // 绘制并缩放图标
            ctx.clearRect(0, 0, targetSize, targetSize);
            ctx.drawImage(img, 0, 0, targetSize, targetSize);
            
            // 将Canvas转换为DataURL
            const processedIconUrl = canvas.toDataURL('image/png');
            
            // 更新预览
            const previewImg = document.createElement('img');
            previewImg.src = processedIconUrl;
            previewImg.alt = "预览";
            previewImg.style.width = "100%";
            previewImg.style.height = "100%";
            previewImg.draggable = false;
            
            elements.iconPreview.innerHTML = '';
            elements.iconPreview.appendChild(previewImg);
        } catch (canvasError) {
            // 如果Canvas处理失败，直接使用原始图标
            const previewImg = document.createElement('img');
            previewImg.src = iconUrl;
            previewImg.alt = "预览";
            previewImg.style.width = "100%";
            previewImg.style.height = "100%";
            previewImg.draggable = false;
            
            // 使用addEventListener替代内联onerror处理器
            previewImg.onerror = () => {
                // 显示默认图标
                showDefaultIcon();
            };
            
            elements.iconPreview.innerHTML = '';
            elements.iconPreview.appendChild(previewImg);
        }
    };
    
    img.onerror = () => {
        // 如果是自动获取且有下一个图标可尝试，则尝试下一个
        if (isAutoFetch && window.tryNextFavicon) {
            // 查找当前URL在数组中的索引
            const urlObj = new URL(iconUrl);
            const domain = urlObj.host;
            const iconUrls = [
                `https://${domain}/favicon.ico`,
                `https://${domain}/favicon.png`,
                `https://${domain}/apple-touch-icon.png`,
                `https://${domain}/apple-touch-icon-precomposed.png`
            ];
            
            const currentIndex = iconUrls.indexOf(iconUrl);
            if (currentIndex >= 0 && currentIndex < iconUrls.length - 1) {
                window.tryNextFavicon(currentIndex + 1);
                return;
            }
        }
        
        // 使用通用图标，不使用百度图标
        showDefaultIcon();
    };
    
    // 只有在非自动获取的情况下才设置img.src触发加载
    if (!isAutoFetch) {
        img.src = iconUrl;
    }
}

// 处理favicon加载错误的全局函数
function handleFaviconError(url) {
    // 如果有下一个图标可尝试，则尝试下一个
    if (window.tryNextFavicon) {
        // 查找当前URL在数组中的索引
        try {
            const urlObj = new URL(url);
            const domain = urlObj.host;
            const iconUrls = [
                `https://${domain}/favicon.ico`,
                `https://${domain}/favicon.png`,
                `https://${domain}/apple-touch-icon.png`,
                `https://${domain}/apple-touch-icon-precomposed.png`
            ];
            
            const currentIndex = iconUrls.indexOf(url);
            if (currentIndex >= 0 && currentIndex < iconUrls.length - 1) {
                window.tryNextFavicon(currentIndex + 1);
                return;
            }
        } catch (e) {
        }
    }
    
    // 显示默认图标
    showDefaultIcon();
    // 显示图标获取失败提示
    showMessageModal('图标获取失败', '提示');
}





// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', function() {
    init();
});