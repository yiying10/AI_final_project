# 樹木渲染分析 - CG-FinalProject

本文檔詳細分析了 [CG-FinalProject](https://github.com/Master7Sword/CG-FinalProject) 專案中樹木的渲染實現方式。

## 概述

在 CG-FinalProject（煙火模擬專案）中，樹木並不是單獨的模型檔案，而是與其他場景元素（如月亮、天空背景）一起整合在 `sky.obj` 檔案中，通過 `Sky` 類別進行渲染。

## 核心組件

### 1. 資料檔案結構

#### 主要檔案
- **3D 模型檔案**: `static/objects/sky.obj` (32,230 行)
- **材質定義檔案**: `static/objects/sky.mtl`
- **紋理資源目錄**: `static/objects/textures/`

#### sky.obj 包含的物件
```
o 天体.001    # 天體（月亮）
o 高.001      # 高物體（可能是樹木）
o 高.002      # 高物體（可能是樹木）
```

#### 使用的材質
sky.obj 使用了三種材質：
1. `Material.004` - 用於月亮
   - 漫反射貼圖: `textures/moon.png`
   - 發光貼圖: `textures/moon.png`

2. `mat_5.001` - 用於場景元素（包括樹木）
   - 漫反射貼圖: `textures/mat_5.002.png`
   - 發光貼圖: `textures/mat_5.002.png`

3. `mat_5.002` - 用於場景元素（包括樹木）
   - 漫反射貼圖: `textures/mat_5.002.png`
   - 發光貼圖: `textures/mat_5.002.png`

#### 樹木相關紋理資源
專案中包含多個與樹木相關的紋理檔案：
```
- Area_Ly_Tree_Common_Pt_Bark_01_Diffuse.png  # 樹皮紋理
- Stages_Unique_CyTree01_Bark01_Diffuse.png   # 櫻花樹樹皮
- leaf01.png                                    # 樹葉 1
- leaf02.png                                    # 樹葉 2
- leaves.png                                    # 樹葉
- tree.png                                      # 樹木紋理
- sakura.png                                    # 櫻花紋理
- sakura_leaves.png                             # 櫻花葉
- blue_on_tree.png                              # 樹上的藍色元素
- mat_5.002.png (1024x1024 RGBA)               # 實際使用的樹木紋理
```

### 2. Sky 類別實現

#### 類別結構
```cpp
class Sky {
public:
    Sky(): VAO(0), VBO(0), EBO(0), shaderProgram(0) {}
    ~Sky();

    bool load(const std::string &objPath, 
              const std::string &materialRootPath, 
              const char *vertPath, 
              const char *fragPath);
    void render(const glm::mat4 &view, 
                const glm::mat4 &projection, 
                const glm::mat4 &model);

private:
    GLuint VAO, VBO, EBO;
    GLuint shaderProgram;
    std::vector<float> vertices;                      
    std::vector<unsigned int> indices;                            
    std::vector<int> materialIndices;
    std::unordered_map<int, GLuint> materialToDiffuseMap;
    std::unordered_map<std::string, int> DiffuseNameToID;
    std::vector<SkyRenderMetaData> textureRenderList;

    GLuint loadTexture(const std::string& path);
    GLuint loadShader(const char* vertexPath, const char* fragmentPath);
};
```

#### SkyRenderMetaData 結構
```cpp
struct SkyRenderMetaData {
    GLuint diffuse;      // 漫反射紋理 ID
    GLsizei size;        // 此批次的頂點數量
    size_t start_idx;    // 此批次的起始索引
};
```

### 3. 渲染管線詳解

#### 步驟 1: 載入 OBJ 檔案
```cpp
bool Sky::load(const std::string &objPath, 
               const std::string &materialRootPath, 
               const char *vertPath, 
               const char *fragPath)
```

此函數執行以下操作：

1. **使用 tinyobj 載入 OBJ 檔案**
```cpp
tinyobj::attrib_t vertexAttr;
std::vector<tinyobj::shape_t> shapes;
std::vector<tinyobj::material_t> materials;

tinyobj::LoadObj(&vertexAttr, &shapes, &materials, &warn, &err, 
                 objPath.c_str(), materialRootPath.c_str());
```

2. **載入所有材質的紋理**
```cpp
for (size_t i = 0; i < materials.size(); ++i) {
    const auto &material = materials[i];
    if (!material.diffuse_texname.empty()) {
        std::string texturePath = materialRootPath + "/" + material.diffuse_texname;
        GLuint textureID = loadTexture(texturePath);
        materialToDiffuseMap[i] = textureID;
        DiffuseNameToID[texturePath] = textureID;
    }
}
```

3. **處理頂點資料**
每個頂點包含 5 個浮點數：
- 3 個位置座標 (x, y, z)
- 2 個紋理座標 (u, v)

```cpp
for (const auto &shape : shapes) {
    for (size_t i = 0; i < shape.mesh.num_face_vertices.size(); ++i) {
        int materialID = shape.mesh.material_ids[i];
        materialIndices.push_back(materialID);
        
        for (size_t j = 0; j < vertexNum; ++j) {
            tinyobj::index_t idx = shape.mesh.indices[indexOffset + j];
            
            // 位置
            glm::vec3 vertexCoord(
                vertexAttr.vertices[3 * idx.vertex_index + 0],
                vertexAttr.vertices[3 * idx.vertex_index + 1],
                vertexAttr.vertices[3 * idx.vertex_index + 2]);
            
            // 紋理座標 (注意 Y 軸翻轉)
            glm::vec2 texCoord(0.0f, 0.0f);
            if (idx.texcoord_index >= 0) {
                texCoord = glm::vec2(
                    vertexAttr.texcoords[2 * idx.texcoord_index + 0],
                    1.0f - vertexAttr.texcoords[2 * idx.texcoord_index + 1]);
            }
            
            vertices.insert(vertices.end(), 
                {vertexCoord.x, vertexCoord.y, vertexCoord.z, 
                 texCoord.x, texCoord.y});
            indices.push_back(indices.size());
        }
    }
}
```

**關鍵點**: 紋理座標的 Y 軸需要翻轉 (`1.0f - texcoord`)，因為 OpenGL 的原點在左下角，而 Blender 的原點在左上角。

4. **建立批次渲染列表**

為了提高效能，將使用相同紋理的連續頂點分組為批次：

```cpp
GLuint lastDiffuseID = -1;
size_t batchStartIdx = 0;

for (size_t idx = 0; idx < vertexNum; idx++) {
    GLuint currentDiffuseID = 0;
    int materialID = materialIndices[idx];
    
    auto itDiffuse = materialToDiffuseMap.find(materialID);
    if (itDiffuse != materialToDiffuseMap.end())
        currentDiffuseID = itDiffuse->second;
    
    // 檢測紋理切換
    if (currentDiffuseID != lastDiffuseID) {
        if (idx - batchStartIdx > 0) {
            // 儲存上一批次
            textureRenderList.push_back(SkyRenderMetaData{
                lastDiffuseID,
                GLsizei(idx - batchStartIdx) * 3,
                batchStartIdx * 3
            });
        }
        batchStartIdx = idx;
        lastDiffuseID = currentDiffuseID;
    }
}
```

5. **設定 OpenGL 緩衝區和頂點屬性**

```cpp
glGenVertexArrays(1, &VAO);
glGenBuffers(1, &VBO);
glGenBuffers(1, &EBO);

glBindVertexArray(VAO);

glBindBuffer(GL_ARRAY_BUFFER, VBO);
glBufferData(GL_ARRAY_BUFFER, vertices.size() * sizeof(float), 
             vertices.data(), GL_STATIC_DRAW);

glBindBuffer(GL_ELEMENT_ARRAY_BUFFER, EBO);
glBufferData(GL_ELEMENT_ARRAY_BUFFER, indices.size() * sizeof(unsigned int), 
             indices.data(), GL_STATIC_DRAW);

// 位置屬性 (location = 0)
glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 5 * sizeof(float), (void*)0);
glEnableVertexAttribArray(0);

// 紋理座標屬性 (location = 1)
glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 5 * sizeof(float), 
                     (void*)(3 * sizeof(float)));
glEnableVertexAttribArray(1);

glBindVertexArray(0);
```

#### 步驟 2: 渲染

```cpp
void Sky::render(const glm::mat4 &view, 
                 const glm::mat4 &projection, 
                 const glm::mat4 &model)
{
    glUseProgram(shaderProgram);
    
    // 設定變換矩陣
    glUniformMatrix4fv(glGetUniformLocation(shaderProgram, "model"), 
                       1, GL_FALSE, &model[0][0]);
    glUniformMatrix4fv(glGetUniformLocation(shaderProgram, "view"), 
                       1, GL_FALSE, &view[0][0]);
    glUniformMatrix4fv(glGetUniformLocation(shaderProgram, "projection"), 
                       1, GL_FALSE, &projection[0][0]);
    
    glBindVertexArray(VAO);
    
    // 批次渲染每個紋理組
    for (const auto &renderMeta : textureRenderList) {
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, renderMeta.diffuse);
        glUniform1i(glGetUniformLocation(shaderProgram, "skyTexture"), 0);
        
        glDrawElements(GL_TRIANGLES, renderMeta.size, GL_UNSIGNED_INT, 
                      (void*)(renderMeta.start_idx * sizeof(unsigned int)));
    }
    
    glBindVertexArray(0);
}
```

### 4. 著色器實現

#### 頂點著色器 (sky.vert)
```glsl
#version 330 core
layout (location = 0) in vec3 aPos;
layout (location = 1) in vec2 aTexCoord;

out vec2 TexCoords;

uniform mat4 model;
uniform mat4 view;
uniform mat4 projection;

void main() {
    TexCoords = aTexCoord;
    gl_Position = projection * view * model * vec4(aPos, 1.0);
}
```

**功能**：
- 接收頂點位置 (`aPos`) 和紋理座標 (`aTexCoord`)
- 應用 MVP (Model-View-Projection) 變換
- 將紋理座標傳遞給片段著色器

#### 片段著色器 (sky.frag)
```glsl
#version 330 core
in vec2 TexCoords;
out vec4 FragColor;

uniform sampler2D skyTexture;

void main() {
    FragColor = texture(skyTexture, TexCoords);
}
```

**功能**：
- 接收插值後的紋理座標
- 從紋理中採樣顏色
- 輸出最終顏色

### 5. 主程式整合

在 `main.cpp` 中，樹木渲染被整合到主渲染迴圈：

```cpp
// 初始化
Sky sky;
if (!sky.load("../../static/objects/sky.obj", 
              "../../static/objects", 
              "../shaders/sky.vert", 
              "../shaders/sky.frag")) {
    return -1;
}

// 渲染迴圈
while (!glfwWindowShouldClose(window)) {
    // ... 其他渲染代碼 ...
    
    glm::mat4 view = Camera::getViewMatrix();
    glm::mat4 projection = glm::perspective(
        glm::radians(45.0f), 
        float(window_width) / window_height, 
        0.1f, 100.0f);
    
    // 渲染天空/樹木，縮放 0.08 倍
    glm::mat4 model = glm::scale(glm::mat4(1.0f), glm::vec3(0.08f));
    sky.render(view, projection, model);
    
    // ... 其他渲染代碼 ...
}
```

**注意**: 天空/樹木模型使用了 0.08 倍的縮放比例。

## 渲染管線流程圖

```
┌─────────────────────────────────────────────────────────────┐
│                      載入階段                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  載入 sky.obj (包含樹木、月亮等)        │
    │  - 使用 tinyobj_loader                   │
    │  - 解析頂點、紋理座標、材質             │
    └──────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  載入紋理 (mat_5.002.png 等)            │
    │  - 建立 materialToDiffuseMap             │
    │  - 儲存紋理 ID                           │
    └──────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  組織頂點資料                            │
    │  - 格式: [x, y, z, u, v] * N            │
    │  - 建立索引陣列                          │
    └──────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  批次化相同紋理的頂點                    │
    │  - 建立 textureRenderList                │
    │  - 減少紋理切換次數                      │
    └──────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  建立 OpenGL 緩衝區                      │
    │  - VAO (Vertex Array Object)             │
    │  - VBO (Vertex Buffer Object)            │
    │  - EBO (Element Buffer Object)           │
    └──────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  編譯和連結著色器                        │
    │  - sky.vert (頂點著色器)                │
    │  - sky.frag (片段著色器)                │
    └──────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                      渲染階段                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  啟用著色器程式                          │
    └──────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  設定 Uniform 變數                       │
    │  - model (模型矩陣，含縮放)              │
    │  - view (視圖矩陣，從相機)               │
    │  - projection (投影矩陣)                 │
    └──────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  綁定 VAO                                 │
    └──────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  對每個紋理批次:                         │
    │  1. 綁定對應的紋理                       │
    │  2. 調用 glDrawElements                  │
    │  3. 渲染該批次的三角形                   │
    └──────────────────────────────────────────┘
                            │
                            ▼
    ┌──────────────────────────────────────────┐
    │  解綁 VAO                                 │
    └──────────────────────────────────────────┘
```

## 技術要點總結

### 1. 設計模式
- **批次渲染**: 將相同紋理的頂點分組，減少紋理切換的開銷
- **資料驅動**: 使用 OBJ 檔案和材質定義，易於修改和擴展
- **封裝**: Sky 類別封裝了所有載入和渲染邏輯

### 2. 效能優化
- **批次繪製**: 通過 `textureRenderList` 減少繪製調用
- **靜態幾何**: 使用 `GL_STATIC_DRAW` 標誌，因為樹木是靜態的
- **索引繪製**: 使用 `glDrawElements` 而非 `glDrawArrays`，共享頂點

### 3. OpenGL 最佳實踐
- **VAO 使用**: 將頂點屬性配置保存在 VAO 中
- **紋理管理**: 使用 map 避免重複載入相同紋理
- **著色器分離**: 頂點和片段著色器分開管理

### 4. 座標系統處理
- **紋理座標翻轉**: 處理 OpenGL 和 Blender 之間的座標差異
- **模型縮放**: 通過 model 矩陣調整場景比例 (0.08x)
- **MVP 變換**: 正確的變換順序: projection * view * model

### 5. 材質系統
- **多紋理支援**: 雖然當前只使用漫反射，但結構支援多種紋理類型
- **材質索引**: 每個面關聯一個材質 ID
- **紋理共享**: 通過 `DiffuseNameToID` 避免重複載入

## 與其他渲染系統的比較

### Sky vs ObjLoader

專案中還有一個更複雜的 `ObjLoader` 類別（用於渲染神社等物件），其與 `Sky` 的主要差異：

| 特性 | Sky | ObjLoader |
|------|-----|-----------|
| 紋理類型 | 僅漫反射 | 漫反射、高光、法線貼圖、發光、透明度 |
| 光照 | 無 | 完整的 Phong 光照模型 |
| 法線資訊 | 無 | 有 |
| 用途 | 背景元素（樹木、天空） | 場景主要物件 |
| 複雜度 | 簡單 | 複雜 |

Sky 類別被簡化是因為樹木作為背景元素，不需要複雜的光照計算。

## 可能的改進方向

1. **LOD (Level of Detail)**
   - 根據距離使用不同細節程度的模型
   - 減少遠處樹木的多邊形數量

2. **實例化渲染**
   - 如果有多棵相同的樹，可使用 `glDrawElementsInstanced`
   - 大幅提升效能

3. **動態效果**
   - 在頂點著色器中添加風的效果
   - 使用正弦函數模擬樹葉擺動

4. **透明度支援**
   - 添加 alpha 測試或混合
   - 正確渲染樹葉的透明部分

5. **更真實的光照**
   - 添加法線貼圖
   - 實現環境遮蔽

## 結論

CG-FinalProject 中的樹木渲染採用了簡潔但有效的方法：
- 將樹木與其他背景元素整合在單一 OBJ 檔案中
- 使用批次渲染提高效能
- 簡單的紋理映射著色器
- 通過模型變換調整比例和位置

這種方法適合作為靜態背景元素，在煙火效果為主的場景中既保證了視覺效果，又不會成為效能瓶頸。

## 參考資源

- [tinyobjloader](https://github.com/tinyobjloader/tinyobjloader) - OBJ 檔案載入庫
- [OpenGL 官方文檔](https://www.opengl.org/documentation/)
- [Learn OpenGL - Model Loading](https://learnopengl.com/Model-Loading/Model)
- 原專案: [CG-FinalProject](https://github.com/Master7Sword/CG-FinalProject)
