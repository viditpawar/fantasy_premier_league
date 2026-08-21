-- Every table is scoped by `season` (e.g. '2025-26') so historical seasons and
-- the current live season can coexist. `player_code` is FPL's stable player
-- identifier across seasons; `player_id`/element ids are only stable within a
-- single season, so cross-season joins should go through `player_code`.

CREATE TABLE IF NOT EXISTS teams (
    season TEXT NOT NULL,
    id INT NOT NULL,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    strength_overall_home INT,
    strength_overall_away INT,
    strength_attack_home INT,
    strength_attack_away INT,
    strength_defence_home INT,
    strength_defence_away INT,
    PRIMARY KEY (season, id)
);

CREATE TABLE IF NOT EXISTS players (
    season TEXT NOT NULL,
    id INT NOT NULL,
    code INT NOT NULL,
    first_name TEXT,
    second_name TEXT,
    web_name TEXT NOT NULL,
    team_id INT NOT NULL,
    element_type INT NOT NULL,
    now_cost INT NOT NULL,
    PRIMARY KEY (season, id),
    FOREIGN KEY (season, team_id) REFERENCES teams (season, id)
);

CREATE TABLE IF NOT EXISTS gameweeks (
    season TEXT NOT NULL,
    id INT NOT NULL,
    name TEXT NOT NULL,
    deadline_time TIMESTAMPTZ,
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    is_next BOOLEAN NOT NULL DEFAULT FALSE,
    average_entry_score INT,
    highest_score INT,
    PRIMARY KEY (season, id)
);

CREATE TABLE IF NOT EXISTS fixtures (
    season TEXT NOT NULL,
    id INT NOT NULL,
    gameweek INT,
    team_h INT NOT NULL,
    team_a INT NOT NULL,
    team_h_score INT,
    team_a_score INT,
    kickoff_time TIMESTAMPTZ,
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (season, id),
    FOREIGN KEY (season, team_h) REFERENCES teams (season, id),
    FOREIGN KEY (season, team_a) REFERENCES teams (season, id)
);

-- One row per player per gameweek: the core historical fact table the AI
-- advisor reasons over.
CREATE TABLE IF NOT EXISTS player_gameweek_stats (
    season TEXT NOT NULL,
    player_code INT NOT NULL,
    player_id INT NOT NULL,
    gameweek INT NOT NULL,
    fixture_id INT,
    team_id INT,
    opponent_team_id INT,
    was_home BOOLEAN,
    minutes INT NOT NULL DEFAULT 0,
    goals_scored INT NOT NULL DEFAULT 0,
    assists INT NOT NULL DEFAULT 0,
    clean_sheets INT NOT NULL DEFAULT 0,
    goals_conceded INT NOT NULL DEFAULT 0,
    own_goals INT NOT NULL DEFAULT 0,
    penalties_saved INT NOT NULL DEFAULT 0,
    penalties_missed INT NOT NULL DEFAULT 0,
    yellow_cards INT NOT NULL DEFAULT 0,
    red_cards INT NOT NULL DEFAULT 0,
    saves INT NOT NULL DEFAULT 0,
    bonus INT NOT NULL DEFAULT 0,
    bps INT NOT NULL DEFAULT 0,
    influence NUMERIC,
    creativity NUMERIC,
    threat NUMERIC,
    ict_index NUMERIC,
    total_points INT NOT NULL DEFAULT 0,
    value INT,
    selected INT,
    transfers_in INT,
    transfers_out INT,
    PRIMARY KEY (season, player_code, gameweek)
);

CREATE TABLE IF NOT EXISTS managers (
    team_id INT PRIMARY KEY,
    name TEXT,
    player_first_name TEXT,
    player_last_name TEXT
);

CREATE TABLE IF NOT EXISTS manager_gameweek_history (
    team_id INT NOT NULL REFERENCES managers (team_id),
    season TEXT NOT NULL,
    gameweek INT NOT NULL,
    points INT,
    total_points INT,
    overall_rank INT,
    bank INT,
    team_value INT,
    event_transfers INT,
    event_transfers_cost INT,
    points_on_bench INT,
    PRIMARY KEY (team_id, season, gameweek)
);

CREATE TABLE IF NOT EXISTS manager_picks (
    team_id INT NOT NULL REFERENCES managers (team_id),
    season TEXT NOT NULL,
    gameweek INT NOT NULL,
    player_id INT NOT NULL,
    player_code INT,
    squad_position INT,
    multiplier INT NOT NULL DEFAULT 1,
    is_captain BOOLEAN NOT NULL DEFAULT FALSE,
    is_vice_captain BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (team_id, season, gameweek, player_id)
);
