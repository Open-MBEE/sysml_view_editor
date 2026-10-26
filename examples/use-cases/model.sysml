package Operations {
    part def Station;
    part def Person;
    use case def 'Inspect station' {
        subject station : Station;
        actor inspector : Person;
    }
    use case 'Operate station' {
        subject station : Station;
        actor operator : Person;
        objective {
            doc /* Deliver the requested service while keeping the station safe. */
        }
        include use case inspection : 'Inspect station' {
            subject station;
            actor inspector = operator;
        }
    }
}
