# MySQL scripts for dropping existing tables and recreating the database table structure

### DROP EVERYTHING ###
# Tables/views must be dropped in reverse order due to referential constraints (foreign keys).
DROP TABLE IF EXISTS `game_review`;
DROP TABLE IF EXISTS `wishlist`;
DROP TABLE IF EXISTS `owned`;
DROP TABLE IF EXISTS `game_platforms`;
DROP TABLE IF EXISTS `platform`;
DROP TABLE IF EXISTS `game`;
DROP TABLE IF EXISTS `genre`;
DROP TABLE IF EXISTS `user`;

### TABLES ###
# Tables must be created in a particular order due to referential constraints i.e. foreign keys.

CREATE TABLE `user` (
  `id`          int(11)       NOT NULL AUTO_INCREMENT,
  `email`       varchar(256)  NOT NULL,
  `first_name`  varchar(64)   NOT NULL,
  `last_name`   varchar(64)   NOT NULL,
  `image_filename`  varchar(64)   DEFAULT NULL,
  `password`    varchar(256)  NOT NULL COMMENT 'Only store the hash here, not the actual password!',
  `auth_token`  varchar(256)  DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_key` (`email`)
);

CREATE TABLE `genre` (
  `id`         int(11)     NOT NULL   AUTO_INCREMENT,
  `name`       varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
);

CREATE TABLE `platform` (
  `id`          int(11)     NOT NULL    AUTO_INCREMENT,
  `name`        varchar(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
);

CREATE TABLE `game` (
  `id`                          int(11)         NOT NULL AUTO_INCREMENT,
  `title`                       VARCHAR(128)    NOT NULL,
  `description`                 VARCHAR(1024)   NOT NULL,
  `creation_date`               DATETIME        NOT NULL,
  `image_filename`              VARCHAR(64)     NULL,
  `creator_id`                    int(11)         NOT NULL,
  `genre_id`                    int(11)         NOT NULL,
  `price`                       int(11)         NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY (`title`),
  FOREIGN KEY (`creator_id`) REFERENCES `user` (`id`),
  FOREIGN KEY (`genre_id`) REFERENCES `genre` (`id`)
);

CREATE TABLE `game_platforms` (
    `id`            int(11)     NOT NULL    AUTO_INCREMENT,
    `game_id`       int(11)     NOT NULL,
    `platform_id`   int(11)     NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY (`game_id`, `platform_id`),
    FOREIGN KEY (`game_id`) REFERENCES `game` (`id`),
    FOREIGN KEY (`platform_id`) REFERENCES `platform` (`id`)
);

CREATE TABLE `wishlist` (
  `id`                          int(11)         NOT NULL AUTO_INCREMENT,
  `game_id`                     int(11)         NOT NULL,
  `user_id`                     int(11)         NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY (`game_id`, `user_id`),
  FOREIGN KEY (`game_id`) REFERENCES `game` (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
);

CREATE TABLE `owned` (
  `id`                          int(11)         NOT NULL AUTO_INCREMENT,
  `game_id`                     int(11)         NOT NULL,
  `user_id`                     int(11)         NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY (`game_id`, `user_id`),
  FOREIGN KEY (`game_id`) REFERENCES `game` (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
);


CREATE TABLE `game_review` (
  `id`                          int(11)         NOT NULL AUTO_INCREMENT,
  `game_id`                     int(11)         NOT NULL,
  `user_id`                     int(11)         NOT NULL,
  `rating`                      int(11)         NOT NULL,
  `review`                      VARCHAR(512)    NULL,
  `timestamp`                   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY (`game_id`, `user_id`),
  FOREIGN KEY (`game_id`) REFERENCES `game` (`id`),
  FOREIGN KEY (`user_id`) REFERENCES `user` (`id`)
);
