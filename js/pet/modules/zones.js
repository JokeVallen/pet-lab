/*!
 * zones 模块 —— 点击分区（几何）与映射（语义）
 *
 * 分区是纯几何：归一化坐标 0~1，与角色图尺寸无关。
 * 映射是另一张表：分区 id → 反应。没有映射的分区回落父级，最终回落默认。
 *
 * 换了角色图只改 zones，加了反应只改 map。
 */


    function createZones(cfg) {
        var zones = cfg.zones || [];
        var map = cfg.map || {};
        var fallbackId = cfg.fallback || 'body';

        // 父级：显式写 parent 优先，没写就按 id 的点号前缀推导（head.crown → head）
        var byId = {};
        zones.forEach(function (z) { if (z && z.id) byId[z.id] = z; });

        function parentOf(id) {
            var z = byId[id];
            if (z && z.parent) return z.parent;
            var dot = String(id).lastIndexOf('.');
            return dot > 0 ? String(id).slice(0, dot) : null;
        }

        // 子级优先：层级越深越先命中；同一层里面积小的先命中，
        // 这样二维矩形彼此重叠时，细的那个总在上面，结果不依赖书写顺序。
        function depth(id) {
            var d = 1, p = parentOf(id), guard = 0;
            while (p && guard++ < 32) { d++; p = parentOf(p); }
            return d;
        }
        function area(z) {
            var xMin = z.xMin == null ? 0 : z.xMin;
            var xMax = z.xMax == null ? 1 : z.xMax;
            return (xMax - xMin) * (z.yMax - z.yMin);
        }
        var sorted = zones.slice().sort(function (a, b) {
            var d = depth(b.id) - depth(a.id);
            return d !== 0 ? d : area(a) - area(b);
        });

        function contains(z, y, x) {
            if (y < z.yMin || y >= z.yMax) return false;
            if (z.xMin != null && x < z.xMin) return false;
            if (z.xMax != null && x >= z.xMax) return false;
            return true;
        }

        /** 命中测试：返回最细的分区 id，未命中返回 null */
        function hit(y, x) {
            var xx = (x == null ? 0.5 : x);
            for (var i = 0; i < sorted.length; i++) {
                if (contains(sorted[i], y, xx)) return sorted[i].id;
            }
            return null;
        }

        /** 沿父级链找映射，找不到返回 null */
        function resolve(zoneId) {
            var id = zoneId || hit(0.5);
            var guard = 0;
            while (id && guard++ < 32) {
                if (map[id]) return { zone: id, rule: map[id] };
                id = parentOf(id);
            }
            return map[fallbackId] ? { zone: fallbackId, rule: map[fallbackId] } : null;
        }

        /** 按权重抽一条（say 可以是数组） */
        function pickSay(rule) {
            if (!rule || !rule.say) return null;
            var list = rule.say;
            if (typeof list === 'string') return list;
            if (!list.length) return null;
            var total = 0;
            var weights = list.map(function (item) {
                var w = (typeof item === 'object' && item.w) || 1;
                total += w;
                return w;
            });
            var r = Math.random() * total;
            for (var i = 0; i < list.length; i++) {
                r -= weights[i];
                if (r <= 0) return typeof list[i] === 'object' ? list[i].t : list[i];
            }
            var last = list[list.length - 1];
            return typeof last === 'object' ? last.t : last;
        }

        return {
            zones: function () { return zones.slice(); },
            hit: hit,
            resolve: resolve,
            pickSay: pickSay,
            depth: depth
        };
    }

    export const PetZones = { createZones: createZones };
