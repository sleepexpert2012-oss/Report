-- =====================================================================
-- Migration v2 — chuyển sang mô hình "BẢNG GHI NHỚ" (mỗi lần import UPDATE lại 1 dòng)
-- Chạy 1 lần trong Supabase → SQL Editor → Run
-- Lưu ý: sẽ XÓA dữ liệu import cũ (test) để tạo ràng buộc duy nhất — không sao vì import lại là có.
-- =====================================================================

truncate table public.dataset;
truncate table public.snapshot;

-- dataset: mỗi 'kind' (main / ads) chỉ 1 dòng, import lại thì cập nhật đè
create unique index if not exists dataset_kind_uidx on public.dataset (kind);

-- snapshot: chỉ 1 dòng 'current', import lại thì cập nhật đè
alter table public.snapshot add column if not exists slot text not null default 'current';
create unique index if not exists snapshot_slot_uidx on public.snapshot (slot);

-- Xong. Từ giờ:
--   • Bảng dataset luôn có tối đa 2 dòng: main + ads (bản mới nhất).
--   • Bảng snapshot luôn có 1 dòng 'current' (dữ liệu dashboard mới nhất).
