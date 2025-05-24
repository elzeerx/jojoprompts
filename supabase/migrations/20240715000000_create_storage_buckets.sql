-- Create buckets for storing different prompt assets
select storage.create_bucket('prompt-videos');
select storage.create_bucket('prompt-audio');
select storage.create_bucket('prompt-files');
