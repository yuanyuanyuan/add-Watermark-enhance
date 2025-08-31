# 缺失导入错误详细登记表（TS2304）

生成时间：2025-08-31  
错误总数：37个  
错误代码：TS2304 - Cannot find name  

## 目录索引（共37个错误）

### 1. browser-e2e.test.ts（6个）
- 错误 1.1-1.5: fireEvent (5处)
- 错误 1.6: waitFor

### 2. test-helpers.ts（31个）
- 错误 2.1-2.13: expect (13处)
- 错误 2.14-2.31: vi (18处)

**总计核实：6 + 31 = 37个 ✅**

---

## 错误登记表

### 1. E2E测试文件缺失导入（6个）

#### 错误 1.1-1.5 fireEvent缺失
- **文件**: `src/__tests__/e2e/browser-e2e.test.ts`
- **位置**: 行158, 184, 197, 298, 299
- **变量**: `fireEvent`
- **Root Cause**: 
  - @testing-library/react 的测试工具函数未导入
  - 可能是重构过程中删除了导入语句
- **影响原功能设计**: 否 - 仅影响测试运行
- **修复方式**: 
  ```typescript
  // 在文件顶部添加
  import { fireEvent } from '@testing-library/react';
  ```
- **Impact评估**: 
  - 影响范围：E2E测试执行
  - 风险等级：低
  - 修复后效果：E2E测试可正常运行

#### 错误 1.6 waitFor缺失
- **文件**: `src/__tests__/e2e/browser-e2e.test.ts`
- **位置**: 行186
- **变量**: `waitFor`
- **Root Cause**: 
  - 异步测试工具函数未导入
  - 与fireEvent同样的问题
- **影响原功能设计**: 否
- **修复方式**: 
  ```typescript
  // 合并到上面的导入语句
  import { fireEvent, waitFor } from '@testing-library/react';
  ```
- **Impact评估**: 
  - 影响范围：异步测试执行
  - 风险等级：低
  - 修复后效果：异步等待功能恢复

---

### 2. 测试辅助文件缺失导入（31个）

#### 错误 2.1-2.13 expect缺失（13个）
- **文件**: `src/utils/test-helpers.ts`
- **位置**: 行110, 116-119, 122-128, 130
- **变量**: `expect`
- **Root Cause**: 
  - Vitest测试框架的断言函数未导入
  - test-helpers作为工具文件需要显式导入
- **影响原功能设计**: 是 - 测试断言功能无法工作
- **修复方式**: 
  ```typescript
  // 在文件顶部添加
  import { expect } from 'vitest';
  ```
- **Impact评估**: 
  - 影响范围：所有使用test-helpers的测试
  - 风险等级：高
  - 修复后效果：断言功能恢复正常

#### 错误 2.14-2.31 vi缺失（18个）
- **文件**: `src/utils/test-helpers.ts`
- **位置**: 行29-43, 65-67
- **变量**: `vi`
- **Root Cause**: 
  - Vitest的mock工具对象未导入
  - vi是Vitest的核心mock API
- **影响原功能设计**: 是 - mock功能完全无法使用
- **修复方式**: 
  ```typescript
  // 合并到expect导入
  import { expect, vi } from 'vitest';
  ```
- **Impact评估**: 
  - 影响范围：所有mock相关功能
  - 风险等级：高
  - 修复后效果：mock功能恢复正常

---

## 修复方案汇总

### 方案一：批量修复（推荐）

```bash
# 1. 修复 browser-e2e.test.ts
echo "import { fireEvent, waitFor } from '@testing-library/react';" | \
  cat - src/__tests__/e2e/browser-e2e.test.ts > temp && \
  mv temp src/__tests__/e2e/browser-e2e.test.ts

# 2. 修复 test-helpers.ts
echo "import { expect, vi } from 'vitest';" | \
  cat - src/utils/test-helpers.ts > temp && \
  mv temp src/utils/test-helpers.ts
```

### 方案二：手动修复

1. **browser-e2e.test.ts** - 在文件顶部添加：
```typescript
import { fireEvent, waitFor } from '@testing-library/react';
```

2. **test-helpers.ts** - 在文件顶部添加：
```typescript
import { expect, vi } from 'vitest';
```

---

## 验证步骤

1. **语法检查**
```bash
npx tsc --noEmit --skipLibCheck
```

2. **运行受影响的测试**
```bash
npm run test src/__tests__/e2e/browser-e2e.test.ts
npm run test -- --grep "test-helpers"
```

3. **确认导入是否正确**
```bash
grep -n "import.*fireEvent\|waitFor" src/__tests__/e2e/browser-e2e.test.ts
grep -n "import.*expect\|vi" src/utils/test-helpers.ts
```

---

## 风险评估

### 高风险项
- **test-helpers.ts** - 影响所有测试的基础工具
  - 缓解措施：先在单个测试文件验证

### 低风险项
- **browser-e2e.test.ts** - 仅影响单个E2E测试文件
  - 缓解措施：运行该测试验证

---

## 依赖关系

- 这些修复应该在其他测试相关修复之前完成
- test-helpers.ts 是基础文件，优先级最高
- 修复后可能暴露其他测试问题

---

## 总结

- **总计37个缺失导入错误**
- **2个文件受影响**
- **4种不同的导入**：fireEvent, waitFor, expect, vi
- **预计修复时间**：10分钟
- **建议**：立即修复，这是最简单的错误类型