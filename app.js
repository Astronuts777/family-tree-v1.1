const familyForm = document.querySelector("#family-form");
const birthDateInput = document.querySelector("#birthDate");
const deathDateInput = document.querySelector("#deathDate");
const ageOutput = document.querySelector("#calculatedAge");
const spouseBirthDateInput = document.querySelector("#spouseBirthDate");
const spouseDeathDateInput = document.querySelector("#spouseDeathDate");
const spouseAgeOutput = document.querySelector("#spouseCalculatedAge");
const summaryCard = document.querySelector("#summary-card");
const searchResult = document.querySelector("#search-result");
const memberList = document.querySelector("#member-list");
const treeRoot = document.querySelector("#tree-root");
const treeCanvas = document.querySelector("#tree-canvas");
const clearTreeButton = document.querySelector("#clear-tree");
const cancelEditButton = document.querySelector("#cancel-edit");
const editBanner = document.querySelector("#edit-banner");
const relatedMemberSelect = document.querySelector("#relatedMemberId");
const relationshipTypeSelect = document.querySelector("#relationshipType");
const searchNameInput = document.querySelector("#search-name");
const searchButton = document.querySelector("#search-button");
const zoomInButton = document.querySelector("#zoom-in");
const zoomOutButton = document.querySelector("#zoom-out");
const zoomResetButton = document.querySelector("#zoom-reset");
const downloadPdfButton = document.querySelector("#download-pdf");

let nextMemberId = 1;
const familyMembers = [];
let treeZoom = 1;
let editingMemberId = null;

function calculateAge(birthDateValue, deathDateValue = "") {
  if (!birthDateValue) {
    return "";
  }

  const birthDate = new Date(birthDateValue);
  const endDate = deathDateValue ? new Date(deathDateValue) : new Date();

  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < birthDate) {
    return "日期无效";
  }

  let age = endDate.getFullYear() - birthDate.getFullYear();
  const monthDiff = endDate.getMonth() - birthDate.getMonth();
  const dayDiff = endDate.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? `${age} 岁` : "日期无效";
}

function updateCalculatedAge() {
  const age = calculateAge(birthDateInput.value, deathDateInput.value);
  ageOutput.value = age || "";
}

function updateSpouseCalculatedAge() {
  const age = calculateAge(spouseBirthDateInput.value, spouseDeathDateInput.value);
  spouseAgeOutput.value = age || "";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function normalizePhotoDataUrl(photoDataUrl) {
  if (typeof photoDataUrl !== "string") {
    return "";
  }

  const normalized = photoDataUrl.trim();

  if (!normalized || normalized === "undefined" || normalized === "null") {
    return "";
  }

  return normalized.startsWith("data:image/") ? normalized : "";
}

function buildNode(title, details, roleClass, photoDataUrl = "") {
  const detailHtml = details
    .filter(Boolean)
    .map((item) => `<p>${item}</p>`)
    .join("");
  const validPhotoDataUrl = normalizePhotoDataUrl(photoDataUrl);
  const photoHtml = validPhotoDataUrl
    ? `<img class="node-photo" src="${validPhotoDataUrl}" alt="${escapeHtml(title)} 的照片" />`
    : "";

  return `
    <article class="node ${roleClass}">
      ${photoHtml}
      <h3>${escapeHtml(title)}</h3>
      ${detailHtml}
    </article>
  `;
}

function buildPersonDetails(member) {
  return [
    `<span class="status">${escapeHtml(member.gender)}</span>`,
    `年龄：${escapeHtml(member.calculatedAge)}`,
    `出生：${escapeHtml(member.birthDate)}`,
    member.deathDate ? `去世：${escapeHtml(member.deathDate)}` : "状态：健在",
    `民族：${escapeHtml(member.ethnicity || "未填写")}`,
    `职务：${escapeHtml(member.jobTitle || "未填写")}`,
    `地址：${escapeHtml(member.address || "未填写")}`,
    `婚姻状态：${escapeHtml(member.maritalStatus)}`,
  ];
}

function buildSpouseDetails(member) {
  return [
    `<span class="status">配偶</span>`,
    `年龄：${escapeHtml(member.spouseCalculatedAge || "未填写")}`,
    `出生：${escapeHtml(member.spouseBirthDate || "未填写")}`,
    member.spouseDeathDate ? `去世：${escapeHtml(member.spouseDeathDate)}` : "状态：健在",
    `职务：${escapeHtml(member.spouseJobTitle || "未填写")}`,
    `婚姻状态：${escapeHtml(member.spouseMaritalStatus || "未填写")}`,
  ];
}

function findMemberById(id) {
  return familyMembers.find((member) => member.id === id) || null;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `请求失败: ${response.status}`;

    try {
      const errorPayload = await response.json();
      if (errorPayload?.error) {
        errorMessage = errorPayload.error;
      }
    } catch (error) {
      // Keep the fallback status message.
    }

    throw new Error(errorMessage);
  }

  return response.json();
}

async function writeStateToDatabase() {
  await requestJson("/api/members", {
    method: "PUT",
    body: JSON.stringify({
      members: familyMembers,
    }),
  });
}

async function deleteStateFromDatabase() {
  await requestJson("/api/members", {
    method: "PUT",
    body: JSON.stringify({
      members: [],
    }),
  });
}

async function saveMembersToStorage() {
  try {
    await writeStateToDatabase();
    return true;
  } catch (error) {
    const protocolHint =
      window.location.protocol === "file:"
        ? "当前页面是直接打开的文件，请改为运行 npm start 后访问 http://127.0.0.1:3000。"
        : "请确认本地 Node 服务正在运行，并且你访问的是 http://127.0.0.1:3000。";

    window.alert(`成员信息写入数据库失败：${error.message}。${protocolHint}`);
    return false;
  }
}

async function loadMembersFromStorage() {
  try {
    const parsedData = await requestJson("/api/members");

    familyMembers.length = 0;
    (parsedData.members || []).forEach((member) => {
      familyMembers.push({
        parentIds: [],
        siblingIds: [],
        spouseIds: [],
        photoDataUrl: "",
        ethnicity: "",
        ...member,
        photoDataUrl: normalizePhotoDataUrl(member.photoDataUrl),
      });
    });
    nextMemberId =
      familyMembers.reduce((maxId, member) => Math.max(maxId, member.id), 0) + 1;
  } catch (error) {
    const protocolHint =
      window.location.protocol === "file:"
        ? "当前页面是直接打开的文件，请改为运行 npm start 后访问 http://127.0.0.1:3000。"
        : "请确认本地 Node 服务正在运行，并且你访问的是 http://127.0.0.1:3000。";

    window.alert(`SQLite 数据库读取失败。${protocolHint}`);
  }
}

function findMemberByIdInGraph(id, extraMembers = []) {
  return familyMembers.find((member) => member.id === id) || extraMembers.find((member) => member.id === id) || null;
}

function addUniqueId(targetList, id) {
  if (!targetList.includes(id)) {
    targetList.push(id);
  }
}

function collectSiblingGroup(startMember, extraMembers = []) {
  const queue = [startMember];
  const visited = new Set();
  const siblings = [];

  while (queue.length) {
    const currentMember = queue.shift();

    if (!currentMember || visited.has(currentMember.id)) {
      continue;
    }

    visited.add(currentMember.id);
    siblings.push(currentMember);

    currentMember.siblingIds.forEach((siblingId) => {
      const sibling = findMemberByIdInGraph(siblingId, extraMembers);

      if (sibling && !visited.has(sibling.id)) {
        queue.push(sibling);
      }
    });
  }

  return siblings;
}

function linkSiblings(memberA, memberB, extraMembers = []) {
  const combinedGroup = [...collectSiblingGroup(memberA, extraMembers), ...collectSiblingGroup(memberB, extraMembers)];
  const uniqueMembers = combinedGroup.filter(
    (member, index) => combinedGroup.findIndex((candidate) => candidate.id === member.id) === index,
  );
  const parentUnion = [...new Set(uniqueMembers.flatMap((member) => member.parentIds))];

  uniqueMembers.forEach((member) => {
    member.parentIds = [...parentUnion];
    uniqueMembers.forEach((candidate) => {
      if (candidate.id !== member.id) {
        addUniqueId(member.siblingIds, candidate.id);
      }
    });
  });
}

function assignParentToMemberAndSiblings(member, parentId, extraMembers = []) {
  collectSiblingGroup(member, extraMembers).forEach((siblingMember) => {
    addUniqueId(siblingMember.parentIds, parentId);
  });
}

function refreshRelationshipOptions() {
  const currentValue = relatedMemberSelect.value;
  const options = ['<option value="">首位成员可留空</option>'];

  familyMembers.forEach((member) => {
    options.push(`<option value="${member.id}">${escapeHtml(member.name)}</option>`);
  });

  relatedMemberSelect.innerHTML = options.join("");

  if (currentValue && familyMembers.some((member) => String(member.id) === currentValue)) {
    relatedMemberSelect.value = currentValue;
  } else if (familyMembers.length) {
    relatedMemberSelect.value = String(familyMembers[familyMembers.length - 1].id);
  }
}

function renderSummary(member) {
  summaryCard.classList.remove("empty");
  summaryCard.innerHTML = `
    <h3>已录入 <strong>${familyMembers.length}</strong> 位成员</h3>
    <p>最新加入：${escapeHtml(member.name)} ｜ 性别：${escapeHtml(member.gender)} ｜ 年龄：${escapeHtml(member.calculatedAge)}</p>
    <p>出生日期：${escapeHtml(member.birthDate)}${member.deathDate ? ` ｜ 去世日期：${escapeHtml(member.deathDate)}` : " ｜ 当前状态：健在"}</p>
    <p>民族：${escapeHtml(member.ethnicity || "未填写")} ｜ 家庭地址：${escapeHtml(member.address || "未填写")}</p>
    <p>职务：${escapeHtml(member.jobTitle || "未填写")} ｜ 婚姻状态：${escapeHtml(member.maritalStatus)}</p>
  `;
}

function renderMemberList() {
  if (!familyMembers.length) {
    memberList.className = "summary-card empty";
    memberList.innerHTML = "<p>已保存成员会显示在这里，可直接编辑或删除。</p>";
    return;
  }

  memberList.className = "summary-card";
  memberList.innerHTML = `
    <h3>成员管理</h3>
    <div class="member-list-grid">
      ${familyMembers
        .map(
          (member) => `
            <div class="member-list-item">
              <div>
                <p><strong>${escapeHtml(member.name)}</strong></p>
                <p>${escapeHtml(member.gender)} ｜ ${escapeHtml(member.calculatedAge)} ｜ ${escapeHtml(member.ethnicity || "未填写民族")}</p>
              </div>
              <div class="member-list-actions">
                <button type="button" class="ghost-btn small-btn" data-action="edit" data-member-id="${member.id}">编辑</button>
                <button type="button" class="ghost-btn small-btn" data-action="delete" data-member-id="${member.id}">删除</button>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderEmptyTree() {
  summaryCard.className = "summary-card empty";
  summaryCard.innerHTML = "<p>暂未生成成员信息。</p>";
  searchResult.className = "summary-card empty";
  searchResult.innerHTML = "<p>搜索结果会显示在这里。</p>";
  renderMemberList();
  treeCanvas.innerHTML = `
    <div class="empty-state">
      <h3>等待生成家谱</h3>
      <p>填完左侧信息后，这里会显示基础树状图。</p>
    </div>
  `;
}

function getChildrenFor(parentId) {
  return familyMembers.filter((member) => member.parentIds.includes(parentId));
}

function buildNodeCluster(member) {
  const selfNode = buildNode(member.name, buildPersonDetails(member), "self primary", member.photoDataUrl);
  const spouseCards = [];

  if (
    member.spouseName ||
    member.spouseBirthDate ||
    member.spouseDeathDate ||
    member.spouseJobTitle ||
    member.spouseMaritalStatus
  ) {
    spouseCards.push(buildNode(member.spouseName || "配偶", buildSpouseDetails(member), "spouse"));
  }

  member.spouseIds.forEach((spouseId) => {
    const spouse = findMemberById(spouseId);

    if (spouse) {
      spouseCards.push(buildNode(spouse.name, buildPersonDetails(spouse), "spouse"));
    }
  });

  return `
    <div class="node-cluster">
      ${selfNode}
      ${spouseCards.join("")}
    </div>
  `;
}

function renderPersonBranch(member, visited = new Set()) {
  if (visited.has(member.id)) {
    return "";
  }

  const nextVisited = new Set(visited);
  nextVisited.add(member.id);
  const children = getChildrenFor(member.id);
  const childBranches = children
    .map((child) => renderPersonBranch(child, nextVisited))
    .filter(Boolean)
    .join("");

  return `
    <li>
      ${buildNodeCluster(member)}
      ${childBranches ? `<ul>${childBranches}</ul>` : ""}
    </li>
  `;
}

function renderTree() {
  if (!familyMembers.length) {
    renderEmptyTree();
    return;
  }

  const rootMembers = familyMembers.filter((member) => {
    if (member.parentIds.length !== 0) {
      return false;
    }

    return !familyMembers.some(
      (otherMember) =>
        otherMember.id < member.id &&
        otherMember.parentIds.length === 0 &&
        otherMember.spouseIds.includes(member.id),
    );
  });
  const memberBranches = rootMembers.map((member) => renderPersonBranch(member)).join("");
  const familyRootNode = buildNode(
    "家谱总览",
    [`已录入成员：${familyMembers.length} 人`, `最后更新：${new Date().toLocaleDateString("zh-CN")}`],
    "family-root",
  );

  treeCanvas.innerHTML = `
    <div class="tree">
      <ul>
        <li>
          ${familyRootNode}
          <ul>
            ${memberBranches}
          </ul>
        </li>
      </ul>
    </div>
  `;
  renderMemberList();
}

function connectRelationship(newMember, relatedMemberId, relationshipType) {
  if (!relatedMemberId || !relationshipType) {
    return;
  }

  const relatedMember = findMemberById(Number(relatedMemberId));

  if (!relatedMember) {
    return;
  }

  if (relationshipType === "father" || relationshipType === "mother") {
    assignParentToMemberAndSiblings(relatedMember, newMember.id, [newMember]);
  }

  if (relationshipType === "son" || relationshipType === "daughter") {
    addUniqueId(newMember.parentIds, relatedMember.id);
  }

  if (relationshipType === "sonInLaw" || relationshipType === "daughterInLaw") {
    addUniqueId(newMember.parentIds, relatedMember.id);
  }

  if (relationshipType === "brother" || relationshipType === "sister") {
    linkSiblings(relatedMember, newMember, [newMember]);
  }

  if (relationshipType === "spouse") {
    addUniqueId(relatedMember.spouseIds, newMember.id);
    addUniqueId(newMember.spouseIds, relatedMember.id);
  }
}

function applyZoom() {
  treeCanvas.style.transform = `scale(${treeZoom})`;
}

function changeZoom(delta) {
  treeZoom = Math.max(0.5, Math.min(1.8, Number((treeZoom + delta).toFixed(2))));
  applyZoom();
}

function updateEditBanner() {
  if (editingMemberId === null) {
    editBanner.className = "summary-card empty form-banner";
    editBanner.innerHTML = "<p>当前为新增模式。</p>";
    return;
  }

  const member = findMemberById(editingMemberId);
  editBanner.className = "summary-card form-banner";
  editBanner.innerHTML = `<p>当前正在编辑：<strong>${escapeHtml(member?.name || "")}</strong>。提交后会更新此成员资料。</p>`;
}

function fillFormForEdit(member) {
  familyForm.name.value = member.name || "";
  familyForm.gender.value = member.gender || "";
  familyForm.birthDate.value = member.birthDate || "";
  familyForm.deathDate.value = member.deathDate || "";
  familyForm.address.value = member.address || "";
  familyForm.ethnicity.value = member.ethnicity || "";
  familyForm.jobTitle.value = member.jobTitle || "";
  familyForm.maritalStatus.value = member.maritalStatus || "";
  familyForm.spouseName.value = member.spouseName || "";
  familyForm.spouseBirthDate.value = member.spouseBirthDate || "";
  familyForm.spouseDeathDate.value = member.spouseDeathDate || "";
  familyForm.spouseJobTitle.value = member.spouseJobTitle || "";
  familyForm.spouseMaritalStatus.value = member.spouseMaritalStatus || "";
  ageOutput.value = member.calculatedAge || "";
  spouseAgeOutput.value = member.spouseCalculatedAge || "";
  relatedMemberSelect.value = "";
  relationshipTypeSelect.value = "";
}

function resetToCreateMode() {
  editingMemberId = null;
  familyForm.reset();
  ageOutput.value = "";
  spouseAgeOutput.value = "";
  if (familyMembers.length) {
    relatedMemberSelect.value = String(familyMembers[familyMembers.length - 1].id);
  }
  relationshipTypeSelect.value = "";
  updateEditBanner();
}

function deleteMember(memberId) {
  const index = familyMembers.findIndex((member) => member.id === memberId);

  if (index === -1) {
    return;
  }

  familyMembers.splice(index, 1);
  familyMembers.forEach((member) => {
    member.parentIds = member.parentIds.filter((id) => id !== memberId);
    member.siblingIds = member.siblingIds.filter((id) => id !== memberId);
    member.spouseIds = member.spouseIds.filter((id) => id !== memberId);
  });

  if (editingMemberId === memberId) {
    resetToCreateMode();
  }

  saveMembersToStorage();
  refreshRelationshipOptions();
  renderTree();
}

function renderSearchResult(member) {
  if (!member) {
    searchResult.className = "summary-card empty";
    searchResult.innerHTML = "<p>未找到对应成员，请换个名字试试。</p>";
    return;
  }

  const validPhotoDataUrl = normalizePhotoDataUrl(member.photoDataUrl);
  const photoHtml = validPhotoDataUrl
    ? `<p><img class="node-photo" src="${validPhotoDataUrl}" alt="${escapeHtml(member.name)} 的照片" /></p>`
    : "";

  searchResult.className = "summary-card";
  searchResult.innerHTML = `
    <h3>${escapeHtml(member.name)} 的信息</h3>
    ${photoHtml}
    <p>性别：${escapeHtml(member.gender)} ｜ 年龄：${escapeHtml(member.calculatedAge)} ｜ 民族：${escapeHtml(member.ethnicity || "未填写")}</p>
    <p>出生日期：${escapeHtml(member.birthDate)}${member.deathDate ? ` ｜ 去世日期：${escapeHtml(member.deathDate)}` : " ｜ 当前状态：健在"}</p>
    <p>地址：${escapeHtml(member.address || "未填写")} ｜ 职务：${escapeHtml(member.jobTitle || "未填写")}</p>
    <p>婚姻状态：${escapeHtml(member.maritalStatus)}</p>
  `;
}

function handleSearch() {
  const query = searchNameInput.value.trim();

  if (!query) {
    searchResult.className = "summary-card empty";
    searchResult.innerHTML = "<p>请输入要搜索的姓名。</p>";
    return;
  }

  const member = familyMembers.find((item) => item.name.includes(query));
  renderSearchResult(member || null);
}

function downloadTreeAsPdf() {
  if (!familyMembers.length) {
    window.alert("请先生成家谱树状图，再导出 PDF。");
    return;
  }

  const printWindow = window.open("", "_blank", "width=1400,height=900");

  if (!printWindow) {
    window.alert("浏览器拦截了弹窗，请允许弹窗后再导出 PDF。");
    return;
  }

  const styleHref = new URL("./styles.css", window.location.href).href;
  const content = treeCanvas.innerHTML;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="UTF-8" />
        <title>家谱树状图</title>
        <link rel="stylesheet" href="${styleHref}" />
        <style>
          body {
            margin: 0;
            padding: 24px;
            background: #fffaf4;
          }

          .tree-canvas {
            width: max-content;
            min-width: 100%;
            transform: none !important;
          }

          .tree-root {
            overflow: visible;
            border: 0;
            padding: 0;
            min-height: auto;
          }
        </style>
      </head>
      <body>
        <h1>家谱树状图</h1>
        <div class="tree-root">
          <div class="tree-canvas">${content}</div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
  };
}

birthDateInput.addEventListener("change", updateCalculatedAge);
deathDateInput.addEventListener("change", updateCalculatedAge);
spouseBirthDateInput.addEventListener("change", updateSpouseCalculatedAge);
spouseDeathDateInput.addEventListener("change", updateSpouseCalculatedAge);
searchButton.addEventListener("click", handleSearch);
searchNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleSearch();
  }
});
zoomInButton.addEventListener("click", () => changeZoom(0.1));
zoomOutButton.addEventListener("click", () => changeZoom(-0.1));
zoomResetButton.addEventListener("click", () => {
  treeZoom = 1;
  applyZoom();
});
downloadPdfButton.addEventListener("click", downloadTreeAsPdf);
cancelEditButton.addEventListener("click", resetToCreateMode);
memberList.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.action;
  const memberId = Number(target.dataset.memberId);

  if (!action || !memberId) {
    return;
  }

  if (action === "edit") {
    const member = findMemberById(memberId);

    if (!member) {
      return;
    }

    editingMemberId = memberId;
    fillFormForEdit(member);
    updateEditBanner();
    return;
  }

  if (action === "delete") {
    const member = findMemberById(memberId);

    if (!member) {
      return;
    }

    const confirmed = window.confirm(`确定要删除 ${member.name} 的信息吗？`);

    if (confirmed) {
      deleteMember(memberId);
    }
  }
});

familyForm.addEventListener("reset", () => {
  window.setTimeout(() => {
    ageOutput.value = "";
    spouseAgeOutput.value = "";
    if (familyMembers.length) {
      relatedMemberSelect.value = String(familyMembers[familyMembers.length - 1].id);
    }
    relationshipTypeSelect.value = "";
  }, 0);
});

clearTreeButton.addEventListener("click", () => {
  const confirmed = window.confirm("确定要清空整个家谱吗？此操作会删除所有已保存成员。");

  if (!confirmed) {
    return;
  }

  familyMembers.length = 0;
  nextMemberId = 1;
  deleteStateFromDatabase().catch((error) => {
    window.alert(`清空数据库失败：${error.message}`);
  });
  renderEmptyTree();
  refreshRelationshipOptions();
  resetToCreateMode();
});

familyForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  updateCalculatedAge();
  updateSpouseCalculatedAge();

  if (ageOutput.value === "日期无效") {
    window.alert("请检查出生日期和去世日期，去世日期不能早于出生日期。");
    return;
  }

  if (spouseAgeOutput.value === "日期无效") {
    window.alert("请检查配偶的出生日期和去世日期，去世日期不能早于出生日期。");
    return;
  }

  const formData = new FormData(familyForm);
  let photoDataUrl = "";

  try {
    photoDataUrl = await readFileAsDataUrl(formData.get("photo"));
  } catch (error) {
    window.alert("照片读取失败，请重新选择照片后再试。");
    return;
  }

  const existingMember = editingMemberId !== null ? findMemberById(editingMemberId) : null;
  const member = {
    id: existingMember ? existingMember.id : nextMemberId++,
    name: formData.get("name")?.toString().trim() || "",
    gender: formData.get("gender")?.toString() || "",
    birthDate: formData.get("birthDate")?.toString() || "",
    deathDate: formData.get("deathDate")?.toString() || "",
    address: formData.get("address")?.toString().trim() || "",
    ethnicity: formData.get("ethnicity")?.toString().trim() || "",
    jobTitle: formData.get("jobTitle")?.toString().trim() || "",
    maritalStatus: formData.get("maritalStatus")?.toString() || "",
    photoDataUrl,
    spouseName: formData.get("spouseName")?.toString().trim() || "",
    spouseBirthDate: formData.get("spouseBirthDate")?.toString() || "",
    spouseDeathDate: formData.get("spouseDeathDate")?.toString() || "",
    spouseJobTitle: formData.get("spouseJobTitle")?.toString().trim() || "",
    spouseMaritalStatus: formData.get("spouseMaritalStatus")?.toString() || "",
    spouseCalculatedAge: spouseAgeOutput.value,
    calculatedAge: ageOutput.value,
    parentIds: existingMember?.parentIds ? [...existingMember.parentIds] : [],
    siblingIds: existingMember?.siblingIds ? [...existingMember.siblingIds] : [],
    spouseIds: existingMember?.spouseIds ? [...existingMember.spouseIds] : [],
  };

  if (
    editingMemberId === null &&
    familyMembers.length &&
    (!formData.get("relatedMemberId") || !formData.get("relationshipType"))
  ) {
    window.alert("从第二位成员开始，请选择与哪位成员的关系，以及关系类型。");
    return;
  }

  if (editingMemberId === null) {
    connectRelationship(member, formData.get("relatedMemberId")?.toString() || "", formData.get("relationshipType")?.toString() || "");
    familyMembers.push(member);
  } else {
    const memberIndex = familyMembers.findIndex((item) => item.id === editingMemberId);

    if (memberIndex !== -1) {
      if (!photoDataUrl && existingMember?.photoDataUrl) {
        member.photoDataUrl = existingMember.photoDataUrl;
      }
      familyMembers[memberIndex] = member;
    }
  }

  const saved = await saveMembersToStorage();

  if (!saved) {
    return;
  }

  refreshRelationshipOptions();
  renderSummary(member);
  renderTree();
  resetToCreateMode();
});

async function initializeApp() {
  await loadMembersFromStorage();
  refreshRelationshipOptions();
  renderTree();
  renderMemberList();
  updateEditBanner();
  applyZoom();
}

initializeApp();
