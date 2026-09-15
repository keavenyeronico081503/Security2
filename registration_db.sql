-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Nov 02, 2025 at 04:21 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `registration_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `security_questions`
--

CREATE TABLE `security_questions` (
  `id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `authQuestion1` varchar(255) NOT NULL,
  `authAnswer1` varchar(255) NOT NULL,
  `authQuestion2` varchar(255) NOT NULL,
  `authAnswer2` varchar(255) NOT NULL,
  `authQuestion3` varchar(255) NOT NULL,
  `authAnswer3` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `security_questions`
--

INSERT INTO `security_questions` (`id`, `user_id`, `authQuestion1`, `authAnswer1`, `authQuestion2`, `authAnswer2`, `authQuestion3`, `authAnswer3`) VALUES
(3, 77, 'petName', '$2y$10$iE5/Pv/x0ohU24CnyBs0SuRFudDj8kpLTMRpH0rQKmPbUazgAMJzq', 'hobby', '$2y$10$Cmnu//RH/w0X3dqV/ASlrOiPzBjKcZJ8I7rJFUDybKlL7eh4e0oNm', 'travel', '$2y$10$wsFeTnBOJ78ZzL4EBAwEzec8hO7TuVhey.zmiuuWKXW9oX1YQZ9a6'),
(4, 78, 'petName', '$2y$10$69UJyI4T2ql40rJlB.1GTeySwXjNJliDkZ8nlAE8LJR7OjUhto4jy', 'hobby', '$2y$10$4yL3B7.3KbsMIOk3sFGACuCq3AnWkJrAA77ljozcgzWNQTKm6agUu', 'travel', '$2y$10$R/NY3U/D1TNkS.HUir4sf.v/XbXTE9uLBiXsWTxtGBVYT4LH.7jx6');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `first_name` varchar(50) NOT NULL,
  `middle_name` varchar(50) DEFAULT NULL,
  `last_name` varchar(50) NOT NULL,
  `suffix` varchar(10) DEFAULT NULL,
  `birthday` date NOT NULL,
  `age` int(11) NOT NULL,
  `gender` enum('Male','Female') NOT NULL,
  `id_number` varchar(20) NOT NULL,
  `email` varchar(100) NOT NULL,
  `username` varchar(50) NOT NULL,
  `password` varchar(255) NOT NULL,
  `street` varchar(100) NOT NULL,
  `barangay` varchar(100) NOT NULL,
  `city` varchar(100) NOT NULL,
  `province` varchar(100) NOT NULL,
  `country` varchar(100) NOT NULL,
  `zip_code` varchar(10) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `registration_status` varchar(20) DEFAULT 'pending'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `first_name`, `middle_name`, `last_name`, `suffix`, `birthday`, `age`, `gender`, `id_number`, `email`, `username`, `password`, `street`, `barangay`, `city`, `province`, `country`, `zip_code`, `created_at`, `registration_status`) VALUES
(33, 'Sachin', 'Luague', 'Kumar', '', '2025-09-11', 0, '', '2025-0001', 'sachin@gmail.com', 'Sachin', '$2y$10$FONKsBHbbJPrTWjJSTOEhex/T1G8INFpGHn.gl4fw5iOxO/OTUPlm', 'Purok 3', 'La Union', 'Cabadbaran City', 'Agusan Del Norte', 'Philippines', '262', '2025-09-26 07:30:46', 'pending'),
(77, 'Sachin', 'Luague', 'Kumar', '', '2004-07-11', 21, '', '2025-0004', 'Sachinkumar@gmail.com', 'Sachin123', '$2y$10$8j/TDffRwRB.M8imjjsrBeYkwNFlZoMPwxTfdq5.kBP.akfldDPxy', 'Purok 3', 'La Union', 'Cabadbaran City', 'Agusan Del Norte', 'Philippines', '2045', '2025-11-01 16:06:32', 'complete'),
(78, 'Sachin', 'Luague', 'Kumar', 'Jr', '2004-07-11', 21, '', '2025-0005', 'Sachinkumar1@gmail.com', 'Sachin1234', '$2y$10$dt.xxlUnEMlGR2BJcwtJGOXIx3bvyQ9AvAyT.kBIJpWoHMrZe6iBG', 'Purok 3', 'La Union', 'Cabadbaran City', 'Agusan Del Norte', 'Philippines', '2045', '2025-11-02 02:40:23', 'complete');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `security_questions`
--
ALTER TABLE `security_questions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `id_number` (`id_number`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `username` (`username`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `security_questions`
--
ALTER TABLE `security_questions`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `security_questions`
--
ALTER TABLE `security_questions`
  ADD CONSTRAINT `security_questions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
