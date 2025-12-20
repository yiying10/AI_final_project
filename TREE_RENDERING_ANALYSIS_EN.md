# Tree Rendering Analysis - CG-FinalProject

This document provides a detailed analysis of how trees are rendered in the [CG-FinalProject](https://github.com/Master7Sword/CG-FinalProject) (Fireworks Simulation).

## Overview

In the CG-FinalProject, trees are not rendered as separate model files. Instead, they are integrated into a single `sky.obj` file along with other scene elements (moon, sky background) and rendered through the `Sky` class.

## Key Components

### 1. Data File Structure

**Main Files:**
- **3D Model**: `static/objects/sky.obj` (32,230 lines)
- **Material Definition**: `static/objects/sky.mtl`
- **Texture Directory**: `static/objects/textures/`

**Objects in sky.obj:**
```
o 天体.001    # "Tianti" - Celestial body (moon)
o 高.001      # "Gao" - Tall object (likely tree, "gao" means "tall" in Chinese)
o 高.002      # "Gao" - Tall object (likely tree)
```

**Materials Used:**
1. `Material.004` - For moon
   - Diffuse map: `textures/moon.png`
   - Emission map: `textures/moon.png`

2. `mat_5.001` & `mat_5.002` - For scene elements including trees
   - Diffuse map: `textures/mat_5.002.png` (1024x1024 RGBA)

**Tree-Related Textures:**
```
- Area_Ly_Tree_Common_Pt_Bark_01_Diffuse.png  # Tree bark
- Stages_Unique_CyTree01_Bark01_Diffuse.png   # Cherry tree bark
- leaf01.png, leaf02.png, leaves.png          # Leaves
- tree.png                                     # Tree texture
- sakura.png, sakura_leaves.png               # Cherry blossom
- mat_5.002.png                                # Main texture used
```

### 2. Sky Class Implementation

**Class Structure:**
```cpp
class Sky {
public:
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
    std::vector<float> vertices;              // [x,y,z,u,v] per vertex
    std::vector<unsigned int> indices;
    std::vector<int> materialIndices;
    std::unordered_map<int, GLuint> materialToDiffuseMap;
    std::vector<SkyRenderMetaData> textureRenderList;  // Batch rendering
};
```

**Render Metadata:**
```cpp
struct SkyRenderMetaData {
    GLuint diffuse;      // Diffuse texture ID
    GLsizei size;        // Number of vertices in this batch
    size_t start_idx;    // Starting index for this batch
};
```

### 3. Rendering Pipeline

#### Loading Phase

1. **Load OBJ File** using tinyobjloader
   ```cpp
   tinyobj::LoadObj(&vertexAttr, &shapes, &materials, &warn, &err, 
                    objPath.c_str(), materialRootPath.c_str());
   ```

2. **Load Textures** for all materials
   ```cpp
   for (const auto &material : materials) {
       if (!material.diffuse_texname.empty()) {
           GLuint textureID = loadTexture(texturePath);
           materialToDiffuseMap[i] = textureID;
       }
   }
   ```

3. **Process Vertex Data** - Each vertex has 5 floats:
   - 3 position coordinates (x, y, z)
   - 2 texture coordinates (u, v)
   
   **Important**: Texture Y-coordinate is flipped (`1.0f - texcoord`) to handle OpenGL vs Blender coordinate system difference. This difference stems from different design philosophies: OpenGL follows mathematical convention (Cartesian coordinate system with origin at bottom-left), while 3D modeling software like Blender typically uses image processing convention (origin at top-left, similar to screen coordinates). Without this flip, textures would appear upside-down in the rendered scene.

4. **Create Batch Rendering List** - Group consecutive vertices with same texture:
   ```cpp
   for (size_t idx = 0; idx < vertexNum; idx++) {
       GLuint currentDiffuseID = materialToDiffuseMap[materialID];
       
       if (currentDiffuseID != lastDiffuseID) {
           // Save previous batch
           textureRenderList.push_back(SkyRenderMetaData{
               lastDiffuseID, size, start_idx
           });
           batchStartIdx = idx;
           lastDiffuseID = currentDiffuseID;
       }
   }
   ```

5. **Setup OpenGL Buffers**:
   ```cpp
   glGenVertexArrays(1, &VAO);
   glGenBuffers(1, &VBO);
   glGenBuffers(1, &EBO);
   
   // Position attribute (location = 0)
   glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 
                        5 * sizeof(float), (void*)0);
   
   // Texture coordinate attribute (location = 1)
   glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 
                        5 * sizeof(float), (void*)(3 * sizeof(float)));
   ```

#### Rendering Phase

```cpp
void Sky::render(const glm::mat4 &view, 
                 const glm::mat4 &projection, 
                 const glm::mat4 &model)
{
    glUseProgram(shaderProgram);
    
    // Set transformation matrices
    glUniformMatrix4fv(glGetUniformLocation(shaderProgram, "model"), 
                       1, GL_FALSE, &model[0][0]);
    glUniformMatrix4fv(glGetUniformLocation(shaderProgram, "view"), 
                       1, GL_FALSE, &view[0][0]);
    glUniformMatrix4fv(glGetUniformLocation(shaderProgram, "projection"), 
                       1, GL_FALSE, &projection[0][0]);
    
    glBindVertexArray(VAO);
    
    // Batch render each texture group
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

### 4. Shader Implementation

**Vertex Shader (sky.vert):**
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

**Fragment Shader (sky.frag):**
```glsl
#version 330 core
in vec2 TexCoords;
out vec4 FragColor;

uniform sampler2D skyTexture;

void main() {
    FragColor = texture(skyTexture, TexCoords);
}
```

### 5. Integration in main.cpp

```cpp
// Initialization
Sky sky;
sky.load("../../static/objects/sky.obj", 
         "../../static/objects", 
         "../shaders/sky.vert", 
         "../shaders/sky.frag");

// Render loop
while (!glfwWindowShouldClose(window)) {
    glm::mat4 view = Camera::getViewMatrix();
    glm::mat4 projection = glm::perspective(
        glm::radians(45.0f), 
        float(window_width) / window_height, 
        0.1f, 100.0f);
    
    // Render sky/trees with 0.08x scale
    glm::mat4 model = glm::scale(glm::mat4(1.0f), glm::vec3(0.08f));
    sky.render(view, projection, model);
}
```

## Rendering Pipeline Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│                      Loading Phase                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
Load sky.obj (trees, moon, etc.) with tinyobj_loader
    │
    ▼
Load textures (mat_5.002.png, etc.) → materialToDiffuseMap
    │
    ▼
Organize vertex data: [x, y, z, u, v] * N + indices
    │
    ▼
Batch vertices with same texture → textureRenderList
    │
    ▼
Create OpenGL buffers (VAO, VBO, EBO)
    │
    ▼
Compile and link shaders (sky.vert, sky.frag)

┌─────────────────────────────────────────────────────────────┐
│                    Rendering Phase                          │
└─────────────────────────────────────────────────────────────┘
    │
    ▼
Activate shader program
    │
    ▼
Set uniforms (model, view, projection matrices)
    │
    ▼
Bind VAO
    │
    ▼
For each texture batch:
  • Bind texture
  • glDrawElements
  • Render triangles
    │
    ▼
Unbind VAO
```

## Key Technical Points

### 1. Design Patterns
- **Batch Rendering**: Group vertices by texture to reduce state changes
- **Data-Driven**: Uses OBJ files and material definitions for flexibility
- **Encapsulation**: Sky class encapsulates all loading and rendering logic

### 2. Performance Optimizations
- **Batched Drawing**: `textureRenderList` reduces draw calls
- **Static Geometry**: Uses `GL_STATIC_DRAW` flag
- **Indexed Drawing**: `glDrawElements` shares vertices

### 3. OpenGL Best Practices
- **VAO Usage**: Stores vertex attribute configuration
- **Texture Management**: Map prevents duplicate texture loading
- **Shader Separation**: Vertex and fragment shaders managed separately

### 4. Coordinate System Handling
- **Texture Flip**: Handles OpenGL vs Blender coordinate differences
- **Model Scaling**: Adjusts scene scale via model matrix (0.08x)
- **MVP Transform**: Correct order: projection * view * model

## Comparison: Sky vs ObjLoader

The project has a more complex `ObjLoader` class (for shrine rendering):

| Feature | Sky | ObjLoader |
|---------|-----|-----------|
| Textures | Diffuse only | Diffuse, specular, normal, emission, alpha |
| Lighting | None | Full Phong lighting model |
| Normals | No | Yes |
| Purpose | Background elements | Main scene objects |
| Complexity | Simple | Complex |

**Why the simplification?** The Sky class is simplified because trees serve as background elements in the fireworks scene. Complex lighting calculations would be unnecessary and wasteful for distant background objects. This design decision prioritizes performance while maintaining visual quality for elements that don't require detailed lighting.

## Potential Improvements

1. **LOD (Level of Detail)**: Use different detail levels based on distance
2. **Instanced Rendering**: Use `glDrawElementsInstanced` for multiple identical trees
3. **Dynamic Effects**: Add wind effect in vertex shader using sine functions
4. **Alpha Support**: Add alpha testing/blending for transparent leaves
5. **Realistic Lighting**: Add normal maps and ambient occlusion

## Conclusion

The tree rendering in CG-FinalProject uses a clean and effective approach:
- Trees integrated with background elements in single OBJ file
- Batch rendering for performance
- Simple texture-mapped shaders
- Model transforms for scaling and positioning

This method is well-suited for static background elements in a fireworks-focused scene, providing visual appeal without becoming a performance bottleneck.

## References

- [tinyobjloader](https://github.com/tinyobjloader/tinyobjloader) - OBJ file loading library
- [OpenGL Documentation](https://www.opengl.org/documentation/)
- [Learn OpenGL - Model Loading](https://learnopengl.com/Model-Loading/Model)
- Original project: [CG-FinalProject](https://github.com/Master7Sword/CG-FinalProject)
