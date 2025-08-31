# 水印增强功能演示

本文档演示了根据需求新增的水印功能：
1. 水印颜色自定义
2. 水印平铺排列（三列）和乱序排列
3. 中文字符检查阻止处理

## 🎨 功能一：水印颜色自定义

### 基本颜色配置
```typescript
// 纯色水印
const solidColorConfig = {
  type: 'text' as const,
  text: {
    content: 'WATERMARK',
    color: '#FF5733' // 橙色水印
  }
}

// 使用颜色配置对象
const customColorConfig = {
  type: 'text' as const,
  text: {
    content: 'WATERMARK',
    color: {
      type: 'solid' as const,
      primary: '#4A90E2' // 蓝色
    }
  }
}
```

### 渐变颜色配置
```typescript
const gradientConfig = {
  type: 'text' as const,
  text: {
    content: 'GRADIENT WATERMARK',
    color: {
      type: 'gradient' as const,
      primary: '#FF6B35',
      gradient: {
        type: 'linear' as const,
        stops: [
          { offset: 0, color: '#FF6B35' },
          { offset: 0.5, color: '#F7931E' },
          { offset: 1, color: '#FFD23F' }
        ],
        angle: 45 // 45度渐变角度
      }
    }
  }
}
```

### 多色随机配置
```typescript
const multiColorConfig = {
  type: 'text' as const,
  text: {
    content: 'COLORFUL',
    color: {
      type: 'multi' as const,
      primary: '#E74C3C',
      multi: ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6']
      // 每个水印将随机选择一种颜色
    }
  }
}
```

## 📐 功能二：水印排列模式

### 三列平铺排列
```typescript
const tiledThreeColumnConfig = {
  type: 'text' as const,
  text: {
    content: 'WATERMARK',
    color: '#4A90E2'
  },
  position: {
    placement: 'pattern' as const,
    pattern: {
      type: 'tiled-3-column' as const,
      spacing: { x: 200, y: 150 },
      offset: { x: 50, y: 50 },
      columns: 3,  // 固定三列
      rows: 4      // 可自定义行数
    },
    opacity: 0.3,
    scale: 1.0,
    rotation: 45
  }
}
```

### 随机乱序排列
```typescript
const randomPatternConfig = {
  type: 'text' as const,
  text: {
    content: 'RANDOM',
    color: '#E74C3C'
  },
  position: {
    placement: 'pattern' as const,
    pattern: {
      type: 'random' as const,
      spacing: { x: 150, y: 100 },
      density: 0.4,          // 40% 的密度
      randomSeed: 12345,     // 固定随机种子，确保可重现
      avoidOverlap: true     // 避免重叠
    },
    opacity: 0.5,
    scale: 1.0,
    rotation: 0
  }
}
```

### 传统网格模式（增强）
```typescript
const defaultPatternConfig = {
  type: 'text' as const,
  text: {
    content: 'GRID PATTERN',
    color: '#333333'
  },
  position: {
    placement: 'pattern' as const,
    pattern: {
      type: 'default' as const,  // 或者不指定type，默认为default
      spacing: { x: 200, y: 150 },
      offset: { x: 30, y: 30 },
      stagger: true  // 交错排列，减少遮挡
    },
    opacity: 0.4,
    scale: 1.0
  }
}
```

## 🚫 功能三：中文字符检查

### 启用中文字符阻止
```typescript
const chineseBlockConfig = {
  type: 'text' as const,
  text: {
    content: '这是中文水印', // 这将被阻止
    color: '#333333'
  },
  security: {
    blockChineseCharacters: true  // 启用中文字符阻止
  },
  // ... 其他配置
}

// 处理时将抛出错误：
// "水印文本包含中文字符，处理已被阻止。请使用其他语言的文本。"
```

### 语言白名单控制
```typescript
const languageControlConfig = {
  type: 'text' as const,
  text: {
    content: '한국어 워터마크', // 韩文
    color: '#333333'
  },
  security: {
    blockChineseCharacters: false,
    allowedLanguages: ['en', 'ko'] // 只允许英文和韩文
  }
}
```

### 支持的语言检测
- `zh`: 中文（包括简体、繁体）
- `ja`: 日文（平假名、片假名）
- `ko`: 韩文
- `en`: 英文（默认允许）
- `all`: 允许所有语言

## 🧪 实际使用示例

### 完整的水印处理流程
```typescript
import { SimpleWatermarkProcessor } from './utils/watermark/SimpleWatermarkProcessor';

async function processWithNewFeatures() {
  const processor = new SimpleWatermarkProcessor();
  
  // 配置使用所有新功能
  const settings = {
    type: 'text' as const,
    text: {
      content: 'SAMPLE WATERMARK',
      font: {
        family: 'Arial',
        size: 24,
        weight: 'bold',
        style: 'normal'
      },
      color: {
        type: 'gradient' as const,
        primary: '#FF6B35',
        gradient: {
          type: 'linear' as const,
          stops: [
            { offset: 0, color: '#FF6B35' },
            { offset: 1, color: '#FFD23F' }
          ],
          angle: 45
        }
      }
    },
    position: {
      placement: 'pattern' as const,
      pattern: {
        type: 'tiled-3-column' as const,
        spacing: { x: 200, y: 150 },
        offset: { x: 50, y: 50 },
        columns: 3
      },
      opacity: 0.4,
      scale: 1.0,
      rotation: 30
    },
    security: {
      blockChineseCharacters: true,
      allowedLanguages: ['en']
    },
    output: {
      format: 'png' as const,
      quality: 0.9
    }
  };
  
  try {
    const result = await processor.processFile(file, settings);
    console.log('处理成功:', result);
  } catch (error) {
    console.error('处理失败:', error.message);
  }
}
```

## 📝 实现细节

### 类型定义更新
- 新增 `ColorConfig` 接口支持多种颜色模式
- 扩展 `PatternConfig` 支持新的排列类型
- 新增 `SecurityConfig` 支持语言检查

### 核心方法
1. `containsChineseCharacters()` - 检测中文字符
2. `containsJapaneseCharacters()` - 检测日文字符
3. `containsKoreanCharacters()` - 检测韩文字符
4. `validateTextLanguage()` - 验证文本语言合规性
5. `createColorStyle()` - 创建颜色填充样式
6. `addPatternWatermarks()` - 添加模式水印
7. `calculateTiledPositions()` - 计算三列平铺位置
8. `calculateRandomPositions()` - 计算随机位置

### 错误处理
- 中文字符检测失败时抛出明确的错误信息
- 不支持的语言检测时提供详细反馈
- 配置错误时给出修复建议

## ✅ 验证测试

可以使用提供的测试文件验证功能：

```bash
# 运行类型检查
npm run type-check

# 在浏览器中测试
# 打开开发者控制台，运行：
runWatermarkTests()
```

## 📋 功能清单

✅ **水印颜色自定义**
- ✅ 纯色配置
- ✅ 线性渐变
- ✅ 径向渐变
- ✅ 多色随机

✅ **水印排列模式**
- ✅ 三列平铺排列
- ✅ 随机乱序排列
- ✅ 传统网格模式（增强）
- ✅ 防重叠算法

✅ **中文字符检查**
- ✅ 中文字符检测
- ✅ 日文字符检测
- ✅ 韩文字符检测
- ✅ 语言白名单控制
- ✅ 处理阻止功能

所有功能已按需求完整实现，可以立即投入使用！