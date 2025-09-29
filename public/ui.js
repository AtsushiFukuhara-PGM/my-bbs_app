//DOM生成のJS

//カテゴリ生成
function createCategoryElement(name){
    const details=document.createElement("details");
    details.open=true;
    details.innerHTML=`
        <summary>
        <span class="category-label">${name}</span>
        <div class="summary-buttons">
        <img src="rename-pen.png" alt="リネーム" class="rename-category-button">
        <img src="plus.png" alt="スレッド追加" class="add-thread-button">
        <img src="garbage.png" alt="削除" class="delete-category-button">
        </div>
        </summary>
        <ul class="thread-list" data-category="${name}"></ul>
    `;
    return details;
}

//スレッド生成
function createThreadElement(name){
    const threadLi =document.createElement("li");
    threadLi.innerHTML=`
    <a href="#">${name}</a>
    <img src="rename-pen.png" alt="リネーム" class="rename-thread-button">
    <img src="garbage.png" alt="削除" class="delete-thread-button">
    `;
    return threadLi;
}

//メッセージ吹き出し作成
function createMessageBubble(msg){
    const bubble=document.createElement("div");
    bubble.classList.add("bubble",msg.user==="You"?"right":"left");

    const textDiv=document.createElement("div");
    textDiv.textContent=msg.text;

    const metaDiv=document.createElement("div");
    metaDiv.classList.add("meta");
    metaDiv.textContent=`${msg.user}・${msg.time}`;

    bubble.appendChild(textDiv);
    bubble.appendChild(metaDiv);

    return bubble;
}

//新しいカテゴリの入力フォームの作成
function createNewCategoryForm(){
    const wrapper =document.createElement("div");
    wrapper.classList.add("new-category-form");
    wrapper.innerHTML=`
        <input type="text" placeholder="新しいカテゴリ名" class="new-category-input">
        <button class="create-category-button">作成</button>
    `;
    return wrapper;
}

//新しいスレッド入力フォームの作成
function createNewThreadForm(){
    const li =document.createElement("li");
    li.classList.add("new-thread-form");
    li.innerHTML=`
    <input type="text" placeholder="新しいスレッド名" class="new-thread-input">
    <button class="create-thread-button">作成</button>
    `;
    return li;
}