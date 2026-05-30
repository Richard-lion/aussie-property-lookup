# Aussie Property Lookup

澳洲房产免费查询工具。输入地址返回完整房产档案。

## Tech Stack

- **Frontend**: Next.js 14 · Tailwind CSS · Phosphor Icons · Chart.js
- **Backend**: Python FastAPI · httpx · BeautifulSoup (scrapers)

## 数据来源（免费）

| 数据 | 源 |
|---|---|
| 房产详情 | allhomes.com.au |
| 在售价格 | realestate.com.au / domain.com.au |
| 已售价格 | onthehouse.com.au |
| 估值参考 | propertyvalue.com.au |

## 本地开发

### 前端
```bash
cd /workspace/aussie-property-lookup
npm install
npm run dev     # http://localhost:3000
npm run build   # 验证构建
```

### 后端（Python）
```bash
cd pyapi
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 环境变量
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 项目结构

```
aussie-property-lookup/
├── app/
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home / search landing
│   ├── globals.css      # Tailwind + design tokens
│   └── property/[address]/page.tsx  # Property detail
├── components/
│   ├── SearchBar.tsx    # Address search input
│   ├── PricePanel.tsx   # 3-column price display
│   ├── StatCard.tsx     # Metric card w/ change rate
│   ├── PropertyBasicInfo.tsx  # Beds/baths/cars/land/year
│   └── SuburbStats.tsx  # Suburb investment dashboard
├── pyapi/
│   ├── main.py          # FastAPI entry point
│   ├── requirements.txt
│   ├── cache.py         # File-based JSON cache
│   ├── api/__init__.py
│   ├── api/property_.py
│   └── scrapers/
│       ├── __init__.py
│       ├── allhomes.py
│       ├── onthehouse.py
│       └── suburb_stats.py
└── README.md
```

## 部署

- **Frontend**: Vercel（推送 main 分支自动部署）
- **Backend**: Railway / Render（Python FastAPI）