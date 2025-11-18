create table if not exists users (
  user_id   text primary key,
  created_at timestamptz default now()
);

create table if not exists trips (
  trip_id      text primary key,
  user_id      text references users(user_id),
  start_time   timestamptz,
  end_time     timestamptz,
  sample_count int,
  created_at   timestamptz default now()
);

create table if not exists trip_raw (
  trip_id   text primary key references trips(trip_id) on delete cascade,
  payload   jsonb not null,
  created_at timestamptz default now()
);

-- Per-event detections (before clustering)
create table if not exists detections (
  trip_id     text references trips(trip_id) on delete cascade,
  ts          timestamptz not null,
  latitude    double precision,
  longitude   double precision,
  intensity   double precision,
  stability   double precision,
  mount_state text,
  primary key (trip_id, ts)
);

create index if not exists idx_detections_geo
  on detections (latitude, longitude);

create index if not exists idx_detections_ts
  on detections (ts);

-- Aggregated pothole clusters across trips
create table if not exists pothole_clusters (
  cluster_id         text primary key,
  latitude           double precision,
  longitude          double precision,
  hits               int,
  users              int,
  last_ts            timestamptz,
  avg_intensity      double precision,
  avg_stability      double precision,
  mount_state_counts jsonb,
  exposure           double precision,
  confidence         double precision,
  priority           double precision,
  updated_at         timestamptz default now()
);

create index if not exists idx_clusters_priority
  on pothole_clusters(priority desc);

create index if not exists idx_clusters_confidence
  on pothole_clusters(confidence desc);

-- Rough road segments (low quality stretches)
create table if not exists road_quality_segments (
  segment_id    text primary key,
  latitude      double precision,
  longitude     double precision,
  roughness     double precision,  -- higher = bumpier
  rough_windows int,               -- how many windows contributed
  trips         int,               -- how many trips contributed
  last_ts       timestamptz,
  confidence    double precision,  -- based on trips & windows
  updated_at    timestamptz default now()
);

create index if not exists idx_road_segments_confidence
  on road_quality_segments(confidence desc);
