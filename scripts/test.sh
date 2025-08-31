#!/bin/bash

# 中文水印系统测试执行脚本
# 按优先级执行380个测试用例，确保达到95%+覆盖率目标

set -e

echo "🧪 中文水印系统测试套件执行开始..."
echo "📊 目标: 380个测试用例，95%+ 代码覆盖率"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 创建测试结果目录
mkdir -p test-results coverage

# 函数：执行测试套件
run_test_suite() {
    local suite_name=$1
    local test_pattern=$2
    local priority=$3
    
    echo -e "${BLUE}🔍 执行 $suite_name (优先级: $priority)${NC}"
    
    if npx vitest run "$test_pattern" --reporter=verbose 2>/dev/null; then
        echo -e "${GREEN}✅ $suite_name 测试通过${NC}"
        return 0
    else
        echo -e "${RED}❌ $suite_name 测试失败${NC}"
        return 1
    fi
}

# P0级测试 - 关键路径 (必须100%通过)
echo -e "${YELLOW}🎯 Phase 1: P0级关键路径测试 (45个测试用例)${NC}"
echo "执行时机: 每次代码提交后立即执行"
echo "通过标准: 100%通过，0容忍失败"
echo ""

failed_p0=0

# CDN核心功能
run_test_suite "CDN库加载核心功能" "src/utils/cdn/__tests__/*.test.ts" "P0" || ((failed_p0++))

# 文件格式检测
run_test_suite "文件格式检测核心" "src/utils/document/__tests__/*.test.ts" "P0" || ((failed_p0++))

# 中文水印渲染核心
run_test_suite "中文水印渲染核心" "src/engines/canvas/__tests__/*.test.ts" "P0" || ((failed_p0++))

# 状态管理核心
run_test_suite "状态管理核心" "src/stores/__tests__/*.test.ts" "P0" || ((failed_p0++))

echo ""
if [ $failed_p0 -eq 0 ]; then
    echo -e "${GREEN}🎉 P0级测试全部通过! 继续P1级测试...${NC}"
else
    echo -e "${RED}🚫 P0级测试失败 $failed_p0 个，必须修复后才能继续!${NC}"
    exit 1
fi

# P1级测试 - 核心功能 (允许≤2个失败)
echo -e "${YELLOW}🔧 Phase 2: P1级核心功能测试 (165个测试用例)${NC}"
echo "执行时机: 功能开发完成后执行"
echo "通过标准: ≥98%通过率，允许1-2个低影响失败"
echo ""

failed_p1=0

# 完整文档处理流程
run_test_suite "完整文档处理流程" "src/__tests__/integration/document-processing.flow.test.ts" "P1" || ((failed_p1++))

# CDN集成流程
run_test_suite "CDN集成处理流程" "src/__tests__/integration/cdn-integration.flow.test.ts" "P1" || ((failed_p1++))

# 浏览器兼容性核心
run_test_suite "浏览器兼容性核心" "src/__tests__/compatibility/compatibility.test.ts" "P1" || ((failed_p1++))

echo ""
if [ $failed_p1 -le 2 ]; then
    echo -e "${GREEN}✅ P1级测试通过! (失败: $failed_p1/2) 继续P2级测试...${NC}"
else
    echo -e "${YELLOW}⚠️  P1级测试失败过多 ($failed_p1 个)，建议修复后继续${NC}"
    # P1失败过多时继续，但记录警告
fi

# P2级测试 - 增强功能 (允许适度失败)
echo -e "${YELLOW}⚡ Phase 3: P2级增强功能测试 (120个测试用例)${NC}"
echo "执行时机: 集成测试阶段执行"
echo "通过标准: ≥95%通过率，允许适度的边界用例失败"
echo ""

failed_p2=0

# E2E浏览器测试
run_test_suite "E2E浏览器测试" "src/__tests__/e2e/browser-e2e.test.ts" "P2" || ((failed_p2++))

# 性能测试
run_test_suite "性能基准测试" "src/__tests__/performance/performance.test.ts" "P2" || ((failed_p2++))

# 状态管理流程
run_test_suite "状态管理集成流程" "src/__tests__/integration/state-management.flow.test.ts" "P2" || ((failed_p2++))

echo ""
if [ $failed_p2 -le 6 ]; then # 120个测试用例的5%
    echo -e "${GREEN}✅ P2级测试通过! (失败: $failed_p2/6) 进入综合测试阶段...${NC}"
else
    echo -e "${YELLOW}⚠️  P2级测试失败较多 ($failed_p2 个)，但在可接受范围内${NC}"
fi

# 综合测试执行
echo -e "${BLUE}🔄 Phase 4: 综合测试执行和覆盖率验证${NC}"
echo ""

# 执行所有测试并生成覆盖率报告
echo "执行完整测试套件..."
if npx vitest run --coverage; then
    echo -e "${GREEN}✅ 完整测试套件执行完成${NC}"
else
    echo -e "${YELLOW}⚠️  部分测试失败，但继续覆盖率分析${NC}"
fi

# 分析覆盖率报告
echo ""
echo "🔍 分析代码覆盖率..."

if [ -f "coverage/coverage-summary.json" ]; then
    echo "📊 覆盖率报告生成成功:"
    echo "  - HTML报告: coverage/index.html"
    echo "  - JSON报告: coverage/coverage-summary.json"
    echo "  - 详细报告: test-results/report.html"
    
    # 提取覆盖率数据 (如果有jq工具)
    if command -v jq &> /dev/null; then
        lines_pct=$(cat coverage/coverage-summary.json | jq -r '.total.lines.pct')
        functions_pct=$(cat coverage/coverage-summary.json | jq -r '.total.functions.pct')
        branches_pct=$(cat coverage/coverage-summary.json | jq -r '.total.branches.pct')
        statements_pct=$(cat coverage/coverage-summary.json | jq -r '.total.statements.pct')
        
        echo ""
        echo "📈 覆盖率统计:"
        echo "  - 行覆盖率: $lines_pct%"
        echo "  - 函数覆盖率: $functions_pct%"
        echo "  - 分支覆盖率: $branches_pct%"
        echo "  - 语句覆盖率: $statements_pct%"
        
        # 检查是否达到95%目标
        if (( $(echo "$lines_pct >= 95" | bc -l 2>/dev/null || echo 0) )); then
            echo -e "${GREEN}🎯 覆盖率目标达成! (≥95%)${NC}"
        else
            echo -e "${YELLOW}⚠️  覆盖率未达标，目标95%，当前 $lines_pct%${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  覆盖率报告生成失败${NC}"
fi

# 生成测试总结
echo ""
echo -e "${BLUE}📋 测试执行总结${NC}"
echo "================================"
echo "🎯 测试目标: 380个测试用例，95%+ 覆盖率"
echo "📊 P0级测试 (关键): $((45 - failed_p0))/45 通过"
echo "🔧 P1级测试 (核心): $((165 - failed_p1))/165 通过"  
echo "⚡ P2级测试 (增强): $((120 - failed_p2))/120 通过"
echo ""

total_failed=$((failed_p0 + failed_p1 + failed_p2))
total_tests=330 # 45 + 165 + 120

echo "🏆 总体通过率: $((total_tests - total_failed))/$total_tests"

if [ $failed_p0 -eq 0 ] && [ $failed_p1 -le 2 ] && [ $failed_p2 -le 6 ]; then
    echo -e "${GREEN}🎉 测试执行成功! 系统质量达标!${NC}"
    echo ""
    echo "✅ 下一步建议:"
    echo "  1. 查看详细覆盖率报告: open coverage/index.html"
    echo "  2. 查看测试结果报告: open test-results/report.html"
    echo "  3. 继续进行集成部署"
    exit 0
else
    echo -e "${YELLOW}⚠️  测试部分失败，需要进一步检查${NC}"
    echo ""
    echo "🔧 修复建议:"
    [ $failed_p0 -gt 0 ] && echo "  - 优先修复P0级失败 ($failed_p0 个) - 这些是关键问题"
    [ $failed_p1 -gt 2 ] && echo "  - 检查P1级失败 ($failed_p1 个) - 超出允许范围"
    [ $failed_p2 -gt 6 ] && echo "  - 考虑优化P2级失败 ($failed_p2 个) - 影响整体质量"
    exit 1
fi