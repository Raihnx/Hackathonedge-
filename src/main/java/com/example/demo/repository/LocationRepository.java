package com.example.demo.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.demo.model.Location;

public interface LocationRepository extends JpaRepository<Location, Long> {
    Optional<Location> findByDoctorId(String doctorId);  // Ensuring it's String
}
