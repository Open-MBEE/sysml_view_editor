package Organization {
    package Common {
        part def Sensor;
    }
    package Control {
        private import Organization::Common::*;
        part def Controller {
            part feedback : Sensor;
        }
    }
    package Plant {
        private import Organization::Control::*;
        part def Installation {
            part controller : Controller;
        }
    }
}
