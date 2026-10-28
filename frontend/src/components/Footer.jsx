import React from 'react';
import { Container, Row, Col } from 'react-bootstrap';

const Footer = () => {
  return (
    <footer className="footer-mentor">
      <Container>
        <Row className="align-items-center gy-2">
          <Col md={6} className="text-center text-md-start">
            <span className="fw-semibold text-white">Mentor<span className="brand-plug">Plug</span></span> — NLP-Based Semantic Mentor-Mentee Recommendation System
          </Col>
          <Col md={6} className="text-center text-md-end text-white-50 small">
            NLP Mentorship Platform &bull; Empowering Growth &bull; 2026
          </Col>
        </Row>
      </Container>
    </footer>
  );
};

export default Footer;
